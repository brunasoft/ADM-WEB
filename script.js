/* ==========================================================================
   SOFT-ATA — script.js (COMPLETO E CORRIGIDO)
   ========================================================================== */

/* ==========================================================================
   0) HELPERS
   ========================================================================== */

/** Seletores rápidos */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

/** Listener sucinto */
const on = (el, ev, fn, opts) => {
  if (!el) return;
  if (el instanceof NodeList || Array.isArray(el)) {
    el.forEach(e => e && e.addEventListener(ev, fn, opts));
  } else {
    el.addEventListener(ev, fn, opts);
  }
};

// Trata string ISO (YYYY-MM-DD) como meia-noite LOCAL
const fmt = (d) => {
  if (d instanceof Date) return d;
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(d + 'T00:00:00');
  }
  return new Date(d);
};

/** Formata data no padrão BR (dd/mm/aaaa) */
const brDate = (d) => {
  const dt = fmt(d);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth()+1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const hm  = (d) => {
  const dt = fmt(d);
  const H  = String(dt.getHours()).padStart(2, '0');
  const M  = String(dt.getMinutes()).padStart(2, '0');
  const S  = String(dt.getSeconds()).padStart(2, '0');
  return `${H}:${M}:${S}`;
};

/** Converte Date/string para YYYY-MM-DD */
function ymd(d){
  const dt = fmt(d);
  const y  = dt.getFullYear();
  const m  = String(dt.getMonth()+1).padStart(2,'0');
  const da = String(dt.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

/** Dias úteis: soma/subtrai N dias úteis a partir de uma data ISO */
function addDiasUteis(dataISO, qtd) {
  let d = (typeof dataISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataISO))
          ? new Date(dataISO + 'T00:00:00')
          : new Date(dataISO);
  let count = 0;
  const inc = qtd >= 0 ? 1 : -1;
  while (count !== qtd) {
    d.setDate(d.getDate() + inc);
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) count += inc;
  }
  return ymd(d);
}

/** Gera um ID curto */
const uid = (p='') => (p ? p + '_' : '') + Math.random().toString(36).slice(2, 8);

/** Toggle atributo hidden */
const hide = (el, v=true) => { if (el) el.hidden = v; };

/** Escapa texto simples para HTML */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m)=>({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));

/** Cria elemento com atributos e filhos */
function h(tag, attrs={}, children=[]) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>{
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  (Array.isArray(children)?children:[children]).forEach(c=>{
    if (c==null) return;
    if (typeof c === 'string') el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

/** Clona um <template> pelo id e retorna o primeiro elemento raiz */
function cloneTpl(id){
  const tpl = document.getElementById(id.replace(/^#/, ''));
  if (!tpl || !tpl.content) return null;
  const frag = tpl.content.cloneNode(true);
  return Array.from(frag.children)[0] || null;
}

// ===== Assistente — helpers e tabelas =====
const fmtBRL = v => isFinite(v) ? v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : '—';

const ASSIST_PARAM = {
  salarioMin: 1518.00,
  tetoINSS: 8157.41,
  fgts: 0.08,
  familia: { teto: 1906.04, valor: 65.00 },
  inssEmp: [
    { ate: 1518.00, aliq: 0.075 },
    { ate: 2793.88, aliq: 0.09  },
    { ate: 4190.83, aliq: 0.12  },
    { ate: 8157.41, aliq: 0.14  }
  ],
  irrf: {
    posMai: [
      { ate: 2428.80, aliq: 0.00, deduzir: 0.00 },
      { ate: 2826.65, aliq: 0.075, deduzir: 182.16 },
      { ate: 3751.05, aliq: 0.15,  deduzir: 394.16 },
      { ate: 4664.68, aliq: 0.225, deduzir: 675.49 },
      { ate: Infinity, aliq: 0.275, deduzir: 908.73 }
    ],
    janAbr: [],
    dedDep: 189.59,
    simpPerc: 0.25,
    simpTeto: 607.20
  }
};

function calcINSS_progressivo(base){
  let restante = Math.min(Math.max(base,0), ASSIST_PARAM.tetoINSS);
  let total = 0, prev = 0;
  for (const f of ASSIST_PARAM.inssEmp){
    const faixa = Math.max(0, Math.min(restante, f.ate) - prev);
    total += faixa * f.aliq; prev = f.ate;
    if (restante <= f.ate) break;
  }
  return { base, inss: total };
}

const calcFGTS = base => Math.max(base,0) * ASSIST_PARAM.fgts;

const tabelaIRRF = key => key === 'jan-abr-2025' ? ASSIST_PARAM.irrf.janAbr : ASSIST_PARAM.irrf.posMai;

function calcIRRF(base, dep, keyComp, usaSimpl){
  const dedDep = dep * ASSIST_PARAM.irrf.dedDep;
  let baseCalc = Math.max(0, base - dedDep);
  if (usaSimpl){
    const desc = Math.min(baseCalc * ASSIST_PARAM.irrf.simpPerc, ASSIST_PARAM.irrf.simpTeto);
    baseCalc = Math.max(0, baseCalc - desc);
  }
  const tab = tabelaIRRF(keyComp);
  if (!tab.length) return { irrf: 0, base: baseCalc };
  const faixa = tab.find(f => baseCalc <= f.ate) || tab.at(-1);
  const ir = Math.max(0, baseCalc * faixa.aliq - faixa.deduzir);
  return { irrf: ir, base: baseCalc };
}

/* ==========================================================================
   1) PERSISTÊNCIA E ESTADO
   ========================================================================== */

const DB = {
  key: 'softata_state_v1',
  load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
    catch { return {}; }
  },
  save(state) { localStorage.setItem(this.key, JSON.stringify(state)); },
};

/** Estado padrão (defaults) */
const defaults = {
  ui: { theme: 'light', currentTab: 'home', sidebarOpen: false, overdueHighlight: true },
  cad: { modulos: ['Fiscal','Contábil','Folha'], motivos: ['Erro no sistema','Dúvida do usuário','Ajuste de cadastro'] },
  clientes: [],
  tickets: [],
  ordens: [],
  calendar: { events: [] },
  profile: { foto: null, nome: '', nascimento: '', setor: '', telSetor: '', emailCorp: '', ramal: ''},
};

const saved = DB.load();
/** Merge seguro */
const state = {
  ui:       { ...defaults.ui, ...(saved.ui || {}) },
  cad:      { ...defaults.cad, ...(saved.cad || {}) },
  clientes: saved.clientes || defaults.clientes,
  tickets:  saved.tickets  || defaults.tickets,
  ordens:   saved.ordens   || defaults.ordens,
  calendar: { events: (saved.calendar && saved.calendar.events) || defaults.calendar.events },
  profile:  { ...defaults.profile, ...(saved.profile || {}) },
};

function persist(){ DB.save(state); }

/* ==========================================================================
   2) HEADER (RELÓGIO E TEMA)
   ========================================================================== */

function initClock() {
  const el = $('#clock');
  if (!el) return;
  const tick = () => el.textContent = hm(new Date());
  tick();
  setInterval(tick, 1000);
}

function applyTheme() {
  const dark = state.ui.theme === 'dark';
  document.body.classList.toggle('theme-dark', dark);
}

function initThemeToggle() {
  const btn = $('#themeSwitch');
  if (!btn) return;
  applyTheme();
  on(btn, 'click', () => {
    state.ui.theme = (state.ui.theme === 'dark') ? 'light' : 'dark';
    applyTheme();
    persist();
  });
}

/* ========================================================================== 
   PERFIL NO HEADER (nome + avatar) 
   ========================================================================== */

function initProfileModal() {
  const btnProfile = $('#btnProfile');
  const profileModal = $('#profileModal');
  const btnClose = $('#profileModalClose');
  const backdrop = profileModal?.querySelector('.modal__backdrop');
  const btnSave = $('#pf_save');

  if (!btnProfile || !profileModal) return;

  const closeModal = () => {
    profileModal.hidden = true;
  };

  const openProfileModal = () => {
    // Preencher formulário
    $('#pf_nome').value = state.profile.nome || '';
    $('#pf_nasc').value = state.profile.nascimento || '';
    $('#pf_setor').value = state.profile.setor || '';
    $('#pf_tel_setor').value = state.profile.telSetor || '';
    $('#pf_email_corp').value = state.profile.emailCorp || '';
    $('#pf_ramal').value = state.profile.ramal || '';
    
    // Preview da foto
    const preview = $('#pf_preview');
    if (preview) {
      if (state.profile.foto) {
        preview.src = state.profile.foto;
      } else {
        const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="#e5e7eb"/><circle cx="40" cy="30" r="15" fill="#94a3b8"/><rect x="15" y="50" width="50" height="18" rx="9" fill="#cbd5e1"/></svg>');
        preview.src = `data:image/svg+xml;charset=UTF-8,${svg}`;
      }
    }
    
    profileModal.hidden = false;
  };

  // Event listeners
  on(btnProfile, 'click', openProfileModal);
  on(btnClose, 'click', closeModal);
  on(backdrop, 'click', closeModal);
  
  // Tecla Escape
  on(document, 'keydown', (e) => {
    if (e.key === 'Escape' && !profileModal.hidden) closeModal();
  });

  // Preview da foto
  const fotoInput = $('#pf_foto');
  const preview = $('#pf_preview');
  if (fotoInput && preview) {
    on(fotoInput, 'change', (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Salvar perfil
  if (btnSave) {
    on(btnSave, 'click', () => {
      const file = fotoInput?.files[0];
      
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          state.profile.foto = e.target.result;
          saveProfile();
        };
        reader.readAsDataURL(file);
      } else {
        saveProfile();
      }
    });
  }

  function saveProfile() {
    state.profile.nome = $('#pf_nome').value.trim();
    state.profile.nascimento = $('#pf_nasc').value;
    state.profile.setor = $('#pf_setor').value.trim();
    state.profile.telSetor = $('#pf_tel_setor').value.trim();
    state.profile.emailCorp = $('#pf_email_corp').value.trim();
    state.profile.ramal = $('#pf_ramal').value.trim();

    persist();
    applyHeaderProfile();
    closeModal();
    
    alert('Perfil salvo com sucesso!');
  }
}

function applyHeaderProfile() {
  const me = state.profile || {};
  const av = document.getElementById('profileAvatar');
  const nm = document.getElementById('profileName');
  const sc = document.getElementById('profileSector');

  if (av) {
    if (me.foto) {
      av.src = me.foto;
    } else {
      const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="100%" height="100%" fill="#e5e7eb"/><circle cx="16" cy="12" r="6" fill="#94a3b8"/><rect x="6" y="20" width="20" height="7" rx="3.5" fill="#cbd5e1"/></svg>');
      av.src = `data:image/svg+xml;charset=UTF-8,${svg}`;
    }
    av.alt = me.nome ? `Foto de ${me.nome}` : 'Foto do perfil';
  }

  if (nm) nm.textContent = (me.nome || '').split(' ')[0] || 'Usuário';
  if (sc) sc.textContent = me.setor || 'Setor';
}

/* ==========================================================================
   3) SIDEBAR E NAVEGAÇÃO POR ABAS
   ========================================================================== */

function openSidebar(v=true){
  state.ui.sidebarOpen = v;
  $('#sidebar')?.classList.toggle('open', v);
  document.body.classList.toggle('with-sidebar', v);
  persist();
}

function initSidebar(){
  on($('#btnHamb'), 'click', () => openSidebar(!state.ui.sidebarOpen));
  openSidebar(state.ui.sidebarOpen);
}

function setTab(name){
  $$('#navList button').forEach(b=>{
    const active = b.getAttribute('data-go') === name;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  
  $$('main > .panel').forEach(p=> hide(p, p.id !== `tab-${name}`));
  state.ui.currentTab = name;
  persist();

  if (name === 'home')      renderHome();
  if (name === 'fila')      renderKanban();
  if (name === 'clientes')  renderClientes();
  if (name === 'ordens')    renderOrdens();
  if (name === 'dashboard') renderKPIs();
  if (name === 'config')    initConfig();
  if (name === 'assistente') renderAssistente();
}

function renderAssistente() {
  console.log('Assistente carregado');
}

function initTabs(){
  $$('#navList button').forEach(btn => on(btn, 'click', () => setTab(btn.dataset.go)));
  setTab(state.ui.currentTab || 'home');
}

/* ==========================================================================
   4) HOME + CALENDÁRIO
   ========================================================================== */

function renderHome(){
  const counts = {
    aberto:      state.tickets.filter(t=>t.col==='aberto').length,
    atendimento: state.tickets.filter(t=>t.col==='atendimento').length,
    programacao: state.tickets.filter(t=>t.col==='programacao').length,
    atrasados:   state.ordens.filter(o=> isAtrasada(o.previsto)).length,
  };

  const cont = $('#homeCards');
  if (cont) {
    cont.innerHTML = '';
    [
      ['Abertos', counts.aberto, 'd-abertas'],
      ['Em atendimento', counts.atendimento, 'd-atend'],
      ['Programação', counts.programacao, 'd-prog'],
      ['Atrasadas', counts.atrasados, 'd-atraso'],
    ].forEach(([lbl,val,klass])=>{
      cont.appendChild(h('div',{class:`dashcard ${klass}`},[
        h('div',{},lbl),
        h('div',{}, String(val))
      ]));
    });
  }

  renderCalendar();
}

/** Estado do calendário */
let calCurrent = (()=>{ const d = new Date(); return {y:d.getFullYear(), m:d.getMonth()}; })();

/** Informações do mês */
function monthInfo(y, m){
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  return { first, startDow, daysInMonth };
}

/** Renderização do calendário */
function renderCalendar(){
  const title    = $('#calTitle');
  const grid     = $('#calGrid');
  const list     = $('#calListItems');
  const listDate = $('#calListDate');
  if (!title || !grid || !list || !listDate) return;

  const {y,m} = calCurrent;
  const locale = 'pt-BR';
  const monthName = new Date(y, m, 1).toLocaleDateString(locale, { month:'long', year:'numeric' });
  title.textContent = monthName[0].toUpperCase() + monthName.slice(1);

  grid.innerHTML = '';
  const { startDow, daysInMonth } = monthInfo(y,m);
  const prevDays = new Date(y, m, 0).getDate();

  for (let i = 0; i < startDow; i++) {
    const day = prevDays - (startDow - 1) + i;
    grid.appendChild(dayCell(y, m-1, day, true));
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(dayCell(y, m, d, false));
  }

  const totalPreenchido = grid.children.length;
  const totalTeorico    = startDow + daysInMonth;
  const semanas         = Math.ceil(totalTeorico / 7);
  const alvo            = semanas * 7;
  const faltam          = Math.max(0, alvo - totalPreenchido);
  
  for (let d = 1; d <= faltam; d++) {
    grid.appendChild(dayCell(y, m+1, d, true));
  }

  const todayISO = ymd(new Date());
  const todayEl  = $(`.cal-cell[data-date="${todayISO}"]`);
  if (todayEl) selectDay(todayISO);
  else if (grid.firstElementChild) selectDay(grid.firstElementChild.dataset.date);

  const prev = $('#calPrev');
  const next = $('#calNext');
  if (prev) prev.onclick = () => { calMove(-1); };
  if (next) next.onclick = () => { calMove(1); };

  function calMove(delta){
    let nm = calCurrent.m + delta;
    let ny = calCurrent.y;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11){ nm = 0;  ny++; }
    calCurrent = {y:ny, m:nm};
    renderCalendar();
  }
}

/** Cria uma célula de dia */
function dayCell(y, m, d, other){
  const date = new Date(y, m, d);
  const iso  = ymd(date);
  const cell = h('div', { class:'cal-cell', 'data-date': iso });

  if (other) cell.classList.add('other');
  if (iso === ymd(new Date())) cell.classList.add('cal-today');

  cell.appendChild(h('div', {class:'cal-day'}, d.toString()));

  const evs = state.calendar.events.filter(ev => ev.date === iso);
  if (evs.length){
    cell.classList.add('has-ev');
    cell.appendChild(h('div',{class:'cal-dot'}));
    cell.appendChild(h('div',{class:'cal-dot-count'}, String(evs.length)));
  }
  on(cell, 'click', ()=> selectDay(iso));

  return cell;
}

/** Atualiza lista de compromissos do dia selecionado */
function selectDay(iso){
  $$('.cal-cell').forEach(c=> c.classList.toggle('selected', c.dataset.date===iso));

  const list     = $('#calListItems');
  const listDate = $('#calListDate');
  if (!list || !listDate) return;

  list.innerHTML = '';
  listDate.textContent = new Date(iso).toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  const evs = state.calendar.events
    .filter(e=> e.date === iso)
    .sort((a,b)=> (a.time||'').localeCompare(b.time||''));

  if (!evs.length){
    list.appendChild(h('div',{class:'chip'},'Sem compromissos.'));
  } else {
    evs.forEach(ev=>{
      list.appendChild(
        h('div',{class:'cal-item'},[
          h('div',{}, `${ev.time||'—'} • ${ev.title}`),
          h('div',{},[
            h('button',{class:'btn sm editar', onClick:()=>editEvent(ev.id)},'Editar'),
            h('button',{class:'btn sm excluir', onClick:()=>delEvent(ev.id)},'Excluir'),
          ])
        ])
      );
    });
  }
}

/** Edição rápida */
function editEvent(id){
  const ev = state.calendar.events.find(e=>e.id===id);
  if (!ev) return;
  $('#ev_title').value = ev.title || '';
  $('#ev_date').value  = ev.date || '';
  $('#ev_time').value  = ev.time || '';
  $('#ev_recur').value = ev.recur || 'none';
  $('#ev_count').value = ev.countType || 'corridos';
}

/** Remove evento */
function delEvent(id){
  state.calendar.events = state.calendar.events.filter(e=> e.id!==id);
  persist();
  renderCalendar();
}

/** Formulário de evento */
function initCalendarForm(){
  const addBtn = $('#ev_add');
  if (!addBtn) return;

  if ($('#ev_date') && !$('#ev_date').value) {
    $('#ev_date').value = ymd(new Date());
  }
  
  if ($('#ev_time') && !$('#ev_time').value) {
    $('#ev_time').value = '09:00';
  }

  on(addBtn, 'click', ()=>{
    const title = $('#ev_title').value.trim();
    const date  = $('#ev_date').value;
    const time  = $('#ev_time').value;
    const recur = $('#ev_recur').value;
    const countType = $('#ev_count').value;

    if (!title || !date){
      alert('Informe ao menos Título e Data.');
      return;
    }

    if (!isValidDate(date)) {
      alert('Data inválida.');
      return;
    }

    const base = { 
      id: uid('ev'), 
      title, 
      date, 
      time: time || null, 
      recur: (recur==='none'?undefined:recur), 
      countType 
    };
    
    const created = [base];

    state.calendar.events.push(...created);
    persist();
    renderCalendar();
    selectDay(date);
    
    $('#ev_title').value = '';
  });
}

/* ==========================================================================
   5) CLIENTES (CRUD)
   ========================================================================== */

function renderClientes(){
  const tb = $('#tblClientes');
  if (!tb) return;
  tb.innerHTML = '';

  if (!state.clientes.length){
    tb.appendChild(h('tr',{}, h('td',{colspan:'5'},'Nenhum cliente cadastrado.')));
    return;
  }

  state.clientes.forEach(c=>{
    const tr = h('tr', {'data-id': c.id}, [
      h('td',{}, c.codigo||'—'),
      h('td',{}, c.nome||'—'),
      h('td',{}, c.telefone||'—'),
      h('td',{}, c.responsavel||'—'),
      h('td',{}, [
        h('button',{class:'btn sm editar', onClick:()=>editCliente(c.id)},'Editar'),
        h('button',{class:'btn sm excluir', onClick:()=>delCliente(c.id)},'Excluir'),
      ])
    ]);
    tb.appendChild(tr);
  });
}

function editCliente(id){
  const c = state.clientes.find(x=>x.id===id);
  if (!c) return;
  $('#c_nome').value   = c.nome || '';
  $('#c_codigo').value = c.codigo || '';
  $('#c_tel').value    = c.telefone || '';
  $('#c_resp').value   = c.responsavel || '';
}

async function delCliente(id){
  const bak = state.clientes.find(c=>c.id===id);
  if (!bak) return;

  state.clientes = state.clientes.filter(c=>c.id!==id);
  persist();
  renderClientes();
  
  alert('Cliente excluído com sucesso!');
}

function initClientesForm(){
  on($('#c_add'), 'click', ()=>{
    const nome  = $('#c_nome').value.trim();
    const codigo= $('#c_codigo').value.trim();
    const tel   = $('#c_tel').value.trim();
    const resp  = $('#c_resp').value.trim();

    if (!nome){ alert('Informe o nome.'); return; }

    let alvo = state.clientes.find(c => c.codigo === codigo && codigo);

    if (alvo){
      const bak = {...alvo};
      Object.assign(alvo, { nome, telefone: tel, responsavel: resp });

      persist();
      renderClientes();
      alert('Cliente atualizado com sucesso!');

    } else {
      const novo = { id: uid('cli'), nome, codigo, telefone: tel, responsavel: resp };

      state.clientes.push(novo);
      persist();
      renderClientes();
      alert('Cliente adicionado com sucesso!');
    }

    $('#c_nome').value = $('#c_codigo').value = $('#c_tel').value = $('#c_resp').value = '';
  });
}

/* ==========================================================================
   FUNÇÕES PARA DATAS
   ========================================================================== */

function isValidDate(dateString) {
  if (!dateString) return false;
  
  const regex1 = /^\d{4}-\d{2}-\d{2}$/;
  const regex2 = /^\d{2}\/\d{2}\/\d{4}$/;
  
  if (!regex1.test(dateString) && !regex2.test(dateString)) return false;
  
  let date;
  if (dateString.includes('/')) {
    const [day, month, year] = dateString.split('/');
    date = new Date(`${year}-${month}-${day}T00:00:00`);
  } else {
    date = new Date(dateString + 'T00:00:00');
  }
  
  return date instanceof Date && !isNaN(date.getTime());
}

function formatDateForDisplay(dateString) {
  if (!dateString) return '—';
  
  try {
    let date;
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      date = new Date(`${year}-${month}-${day}T00:00:00`);
    } else {
      date = new Date(dateString + 'T00:00:00');
    }
    
    if (isNaN(date.getTime())) return dateString;
    
    return date.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

function initUtilDateConverter() {
  const fmtBtn = $('#u_fmt');
  if (!fmtBtn) return;

  on(fmtBtn, 'click', () => {
    const dtInput = $('#u_dt').value;
    const locale = $('#u_locale').value;
    
    if (!dtInput) {
      $('#u_dt_out').innerHTML = '<span class="chip">Informe uma data/hora</span>';
      return;
    }

    try {
      const date = new Date(dtInput);
      if (isNaN(date.getTime())) {
        $('#u_dt_out').innerHTML = '<span class="chip">Data/hora inválida</span>';
        return;
      }

      const formatted = date.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit'
      });

      $('#u_dt_out').innerHTML = `<span class="chip">${formatted}</span>`;
    } catch (error) {
      $('#u_dt_out').innerHTML = '<span class="chip">Erro na formatação</span>';
    }
  });
}

function initWhatsAppGenerator() {
  const btn = $('#u_go');
  if (!btn) return;

  on(btn, 'click', () => {
    const tel = $('#u_tel').value.trim().replace(/\D/g, '');
    const msg = $('#u_msg').value.trim();
    
    if (!tel) {
      alert('Informe o número de telefone.');
      return;
    }

    const url = `https://wa.me/55${tel}${msg ? `?text=${encodeURIComponent(msg)}` : ''}`;
    
    $('#u_out').innerHTML = `
      <span class="chip"><a href="${url}" target="_blank">Abrir WhatsApp</a></span>
      <span class="chip" onclick="navigator.clipboard.writeText('${url}')" style="cursor:pointer">Copiar link</span>
    `;
  });
}

/* ==========================================================================
   6) ATENDIMENTO (KANBAN + MODAIS) - CORRIGIDO
   ========================================================================== */

function getCurrentProfile() {
  const p = state.profile || {};
  const nome = (p.nome || '').trim();
  return {
    nome,
    firstName: nome.split(/\s+/)[0] || 'Usuário',
    foto: p.foto || ''
  };
}

const COLS = ['aberto','atendimento','aguardando','programacao','concluido'];

function renderKanban(){
  // Atualizar dropdowns de módulos e motivos
  const modSel = $('#t_modulo'), motSel = $('#t_motivo');
  if (modSel && motSel){
    modSel.innerHTML = '<option value="">Selecione o módulo</option>' + 
      state.cad.modulos.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    motSel.innerHTML = '<option value="">Selecione o motivo</option>' + 
      state.cad.motivos.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  }

  // Atualizar dropdown de clientes
  const cliSel = $('#t_cliente');
  const cliInfo = $('#t_cliente_info');
  if (cliSel){
    const selected = cliSel.value;
    cliSel.innerHTML = '<option value="">Selecione um cliente…</option>' +
      state.clientes.map(c =>
        `<option value="${esc(c.id)}">${esc(c.codigo || '')}${c.codigo ? ' — ' : ''}${esc(c.nome || '')}</option>`
      ).join('');
    
    if (selected) cliSel.value = selected;
    
    on(cliSel, 'change', () => {
      const c = state.clientes.find(x => x.id === cliSel.value);
      if (cliInfo) cliInfo.textContent = c ? `${c.codigo || '—'} — ${c.nome || '—'}` : 'Nenhum cliente selecionado';
    });
    
    const c0 = state.clientes.find(x => x.id === cliSel.value);
    if (cliInfo) cliInfo.textContent = c0 ? `${c0.codigo || '—'} — ${c0.nome || '—'}` : 'Nenhum cliente selecionado';
  }

  // Renderizar colunas do kanban
  COLS.forEach(col => {
    const list = $(`#col-${col}`);
    if (!list) return;
    list.innerHTML = '';

    const items = state.tickets.filter(t => t.col === col);
    
    // Contador de itens
    const countEl = $(`#count-${col}`);
    if (countEl) countEl.textContent = items.length;

    if (!items.length){
      const emptyState = h('div', {class: 'empty-state'}, [
        h('i', {class: col === 'aberto' ? 'fas fa-inbox' : 
                  col === 'atendimento' ? 'fas fa-user-clock' :
                  col === 'aguardando' ? 'fas fa-clock' :
                  col === 'programacao' ? 'fas fa-calendar-check' :
                  'fas fa-check-circle'}),
        h('p', {}, col === 'aberto' ? 'Nenhum atendimento em aberto' :
                   col === 'atendimento' ? 'Nenhum atendimento em andamento' :
                   col === 'aguardando' ? 'Nenhum atendimento aguardando' :
                   col === 'programacao' ? 'Nenhum atendimento programado' :
                   'Nenhum atendimento concluído')
      ]);
      list.appendChild(emptyState);
      return;
    }

    items.forEach(t => {
      const card = createTicketCard(t, col);
      if (card) list.appendChild(card);
    });
  });
}

function createTicketCard(t, col) {
  // Usar template diferente para a coluna "concluido"
  const templateId = col === 'concluido' ? 'ticketCardConcluidoTpl' : 'ticketCardTpl';
  const card = cloneTpl(templateId);
  if (!card) return null;

  card.dataset.id = t.id;
  card.dataset.status = t.col;

  const tituloCliente = (t.codigo || t.nome) 
    ? `${t.codigo || '—'} — ${t.nome || '—'}` 
    : (t.titulo || 'Sem cliente');
  
  card.querySelector('[data-field="titulo"]').textContent = tituloCliente;
  card.querySelector('[data-field="modulo"]').textContent = t.modulo || '—';
  card.querySelector('[data-field="motivo"]').textContent = t.motivo || '—';
  card.querySelector('[data-field="data"]').textContent = t.data ? brDate(t.data) : '—';
  card.querySelector('[data-field="responsavel"]').textContent = t.responsavel || '—';

  // Botões de ação
  const btnEdit = card.querySelector('.btn.editar');
  const btnDel = card.querySelector('.btn.excluir');
  const btnLancar = card.querySelector('.btn.lancar');

  if (btnEdit) on(btnEdit, 'click', (e) => {
    e.stopPropagation();
    editTicket(t.id);
  });

  if (btnDel) on(btnDel, 'click', (e) => {
    e.stopPropagation();
    deleteTicket(t.id);
  });

  // Botão Lançar só existe no template de concluído
  if (btnLancar) {
    on(btnLancar, 'click', (e) => {
      e.stopPropagation();
      lancarParaOrdens(t.id);
    });
  }

  // Drag and drop
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', t.id);
    card.classList.add('dragging');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
  });

  return card;
}

function initKanbanDnD(){
  COLS.forEach(col => {
    const list = $(`#col-${col}`);
    if (!list) return;

    list.addEventListener('dragover', (e) => {
      e.preventDefault();
      list.classList.add('drag-over');
    });

    list.addEventListener('dragleave', () => {
      list.classList.remove('drag-over');
    });

    list.addEventListener('drop', (e) => {
      e.preventDefault();
      list.classList.remove('drag-over');
      
      const ticketId = e.dataTransfer.getData('text/plain');
      moveTicket(ticketId, col);
    });
  });
}

function moveTicket(ticketId, newCol) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  // Atualizar responsável se estiver sendo movido para atendimento
  if (newCol === 'atendimento' && ticket.col !== 'atendimento') {
    const profile = getCurrentProfile();
    ticket.responsavel = profile.firstName;
  }

  ticket.col = newCol;
  persist();
  renderKanban();
}

/* ==========================================================================
   FUNÇÃO PARA LANÇAR ATENDIMENTO PARA ORDENS
   ========================================================================== */

function lancarParaOrdens(ticketId) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) {
    alert('Atendimento não encontrado.');
    return;
  }

  // Verificar se já existe uma ordem para este atendimento
  const ordemExistente = state.ordens.find(o => o.ticketId === ticketId);
  if (ordemExistente) {
    alert('Este atendimento já foi lançado como ordem de serviço.');
    return;
  }

  // Criar nova ordem de serviço baseada no atendimento
  const novaOrdem = {
    id: uid('ord'),
    ticketId: ticketId, // Referência ao atendimento original
    numero: `OS-${Date.now().toString().slice(-6)}`, // Número único
    cliente: ticket.nome || 'Cliente não informado',
    servico: `${ticket.modulo || 'Serviço'} - ${ticket.motivo || 'Atendimento'}`,
    abertura: ymd(new Date()),
    previsto: '', // Pode ser preenchido posteriormente
    status: 'aberta',
    descricao: `Origem: Atendimento ${ticket.id}\nMódulo: ${ticket.modulo || '—'}\nMotivo: ${ticket.motivo || '—'}\nResponsável: ${ticket.responsavel || '—'}`
  };

  // Adicionar à lista de ordens
  state.ordens.push(novaOrdem);

  // Remover o atendimento da lista de tickets (ou marcar como processado)
  state.tickets = state.tickets.filter(t => t.id !== ticketId);

  // Persistir mudanças
  persist();

  // Atualizar as interfaces
  renderKanban();
  renderOrdens();

  // Mostrar mensagem de sucesso
  alert(`Atendimento lançado como ordem de serviço ${novaOrdem.numero} com sucesso!`);

  // Opcional: navegar para a aba de ordens
  setTab('ordens');
}

function editTicket(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  // Preencher formulário
  $('#e_ticket_id').value = t.id;
  $('#e_titulo').value = t.titulo || '';
  $('#e_modulo').value = t.modulo || '';
  $('#e_motivo').value = t.motivo || '';
  $('#e_data').value = t.data || '';

  // Mostrar modal de edição
  $('#editModal').hidden = false;
}

function deleteTicket(id) {
  if (!confirm('Tem certeza que deseja excluir este atendimento?')) return;

  state.tickets = state.tickets.filter(t => t.id !== id);
  persist();
  renderKanban();
}

/* ==========================================================================
   FORMULÁRIO DE ATENDIMENTO - NOVO E CORRIGIDO
   ========================================================================== */

function initAtendimentoForm() {
  const btnAdd = $('#t_add');
  if (!btnAdd) return;

  // Inicializar data atual
  if ($('#t_data') && !$('#t_data').value) {
    $('#t_data').value = ymd(new Date());
  }

  on(btnAdd, 'click', () => {
    const clienteId = $('#t_cliente').value;
    const solicitante = $('#t_solicitante').value.trim();
    const modulo = $('#t_modulo').value;
    const motivo = $('#t_motivo').value;
    const data = $('#t_data').value;

    // Validações
    if (!clienteId) {
      alert('Selecione um cliente.');
      return;
    }

    if (!modulo) {
      alert('Selecione o módulo.');
      return;
    }

    if (!motivo) {
      alert('Selecione o motivo.');
      return;
    }

    if (!data || !isValidDate(data)) {
      alert('Informe uma data válida.');
      return;
    }

    // Buscar dados do cliente
    const cliente = state.clientes.find(c => c.id === clienteId);
    if (!cliente) {
      alert('Cliente não encontrado.');
      return;
    }

    // Criar novo ticket
    const novoTicket = {
      id: uid('tkt'),
      clienteId: clienteId,
      nome: cliente.nome,
      codigo: cliente.codigo,
      solicitante: solicitante || 'Não informado',
      modulo: modulo,
      motivo: motivo,
      data: data,
      responsavel: getCurrentProfile().firstName,
      col: 'aberto',
      descricao: '',
      problema: '',
      solucao: ''
    };

    state.tickets.push(novoTicket);
    persist();
    renderKanban();

    // Limpar formulário
    $('#t_cliente').value = '';
    $('#t_solicitante').value = '';
    $('#t_modulo').value = '';
    $('#t_motivo').value = '';
    $('#t_data').value = ymd(new Date());
    
    // Atualizar info do cliente
    const cliInfo = $('#t_cliente_info');
    if (cliInfo) cliInfo.textContent = 'Nenhum cliente selecionado';

    alert('Atendimento adicionado com sucesso!');
  });

  // Inicializar formulários de edição
  initEditTicketForm();
}

function initEditTicketForm() {
  const modal = $('#editModal');
  const btnSave = $('#e_save');
  const btnCancel = $('#e_cancel');

  if (!modal || !btnSave) return;

  on(btnSave, 'click', () => {
    const id = $('#e_ticket_id').value;
    const titulo = $('#e_titulo').value.trim();
    const modulo = $('#e_modulo').value;
    const motivo = $('#e_motivo').value;
    const data = $('#e_data').value;

    if (!titulo || !modulo || !motivo || !data) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    const ticket = state.tickets.find(t => t.id === id);
    if (ticket) {
      ticket.titulo = titulo;
      ticket.modulo = modulo;
      ticket.motivo = motivo;
      ticket.data = data;

      persist();
      renderKanban();
      modal.hidden = true;
      alert('Atendimento atualizado com sucesso!');
    }
  });

  on(btnCancel, 'click', () => {
    modal.hidden = true;
  });

  // Fechar modal no backdrop
  on(modal.querySelector('.modal__backdrop'), 'click', () => {
    modal.hidden = true;
  });
}

/* ==========================================================================
   7) ORDENS DE SERVIÇO
   ========================================================================== */

function renderOrdens(){
  const tb = $('#tblOrdens');
  if (!tb) return;
  tb.innerHTML = '';

  if (!state.ordens.length){
    tb.appendChild(h('tr',{}, h('td',{colspan:'7'},'Nenhuma ordem de serviço cadastrada.')));
    return;
  }

  const hoje = new Date();
  state.ordens.forEach(o=>{
    const tr = h('tr', {'data-id': o.id}, [
      h('td',{}, o.numero||'—'),
      h('td',{}, o.cliente||'—'),
      h('td',{}, o.servico||'—'),
      h('td',{}, o.abertura ? brDate(o.abertura) : '—'),
      h('td',{}, o.previsto ? brDate(o.previsto) : '—'),
      h('td',{}, [
        h('span',{class: `pill ${o.status||'aberta'}`}, getStatusText(o.status))
      ]),
      h('td',{}, [
        h('button',{class:'btn sm editar', onClick:()=>editOrdem(o.id)},'Editar'),
        h('button',{class:'btn sm excluir', onClick:()=>delOrdem(o.id)},'Excluir'),
      ])
    ]);

    // Destacar ordens atrasadas
    if (isAtrasada(o.previsto)) {
      tr.classList.add('atrasada');
    }

    tb.appendChild(tr);
  });
}

function getStatusText(status) {
  const statusMap = {
    'aberta': 'Aberta',
    'andamento': 'Em Andamento',
    'pausada': 'Pausada',
    'concluida': 'Concluída',
    'cancelada': 'Cancelada'
  };
  return statusMap[status] || status || 'Aberta';
}

function isAtrasada(dataPrevista) {
  if (!dataPrevista) return false;
  
  try {
    const hoje = new Date();
    const prevista = new Date(dataPrevista + 'T00:00:00');
    
    // Considerar apenas a data, ignorando horas
    hoje.setHours(0, 0, 0, 0);
    prevista.setHours(0, 0, 0, 0);
    
    return prevista < hoje;
  } catch {
    return false;
  }
}

function editOrdem(id){
  const o = state.ordens.find(x=>x.id===id);
  if (!o) return;
  
  $('#o_id').value = o.id;
  $('#o_numero').value = o.numero || '';
  $('#o_cliente').value = o.cliente || '';
  $('#o_servico').value = o.servico || '';
  $('#o_abertura').value = o.abertura || '';
  $('#o_previsto').value = o.previsto || '';
  $('#o_status').value = o.status || 'aberta';
  $('#o_descricao').value = o.descricao || '';
}

function delOrdem(id){
  if (!confirm('Tem certeza que deseja excluir esta ordem de serviço?')) return;

  state.ordens = state.ordens.filter(o=>o.id!==id);
  persist();
  renderOrdens();
  
  alert('Ordem de serviço excluída com sucesso!');
}

function initOrdensForm(){
  on($('#o_add'), 'click', ()=>{
    const id = $('#o_id').value;
    const numero = $('#o_numero').value.trim();
    const cliente = $('#o_cliente').value.trim();
    const servico = $('#o_servico').value.trim();
    const abertura = $('#o_abertura').value;
    const previsto = $('#o_previsto').value;
    const status = $('#o_status').value;
    const descricao = $('#o_descricao').value.trim();

    if (!numero || !cliente || !servico || !abertura){
      alert('Preencha os campos obrigatórios: Número, Cliente, Serviço e Data de Abertura.');
      return;
    }

    if (!isValidDate(abertura)) {
      alert('Data de abertura inválida.');
      return;
    }

    if (previsto && !isValidDate(previsto)) {
      alert('Data prevista inválida.');
      return;
    }

    const ordemData = {
      id: id || uid('ord'),
      numero,
      cliente,
      servico,
      abertura,
      previsto: previsto || '',
      status: status || 'aberta',
      descricao
    };

    if (id){
      const index = state.ordens.findIndex(x=>x.id===id);
      if (index !== -1) state.ordens[index] = ordemData;
    } else {
      state.ordens.push(ordemData);
    }

    persist();
    renderOrdens();
    
    // Limpar formulário
    $('#o_id').value = '';
    $('#o_numero').value = $('#o_cliente').value = $('#o_servico').value = $('#o_descricao').value = '';
    $('#o_abertura').value = ymd(new Date());
    $('#o_previsto').value = '';
    $('#o_status').value = 'aberta';
    
    alert(`Ordem de serviço ${id ? 'atualizada' : 'adicionada'} com sucesso!`);
  });

  // Inicializar data de abertura
  if ($('#o_abertura') && !$('#o_abertura').value) {
    $('#o_abertura').value = ymd(new Date());
  }
}

/* ==========================================================================
   8) DASHBOARD (KPIs)
   ========================================================================== */

function renderKPIs(){
  // Estatísticas básicas
  const stats = {
    totalTickets: state.tickets.length,
    totalOrdens: state.ordens.length,
    totalClientes: state.clientes.length,
    ticketsAbertos: state.tickets.filter(t=>t.col==='aberto').length,
    ticketsAtendimento: state.tickets.filter(t=>t.col==='atendimento').length,
    ticketsConcluidos: state.tickets.filter(t=>t.col==='concluido').length,
    ordensAtrasadas: state.ordens.filter(o=> isAtrasada(o.previsto)).length,
    ordensAbertas: state.ordens.filter(o=>o.status==='aberta').length,
    ordensConcluidas: state.ordens.filter(o=>o.status==='concluida').length,
  };

  // Atualizar cards do dashboard
  const kpiCards = $('#kpiCards');
  if (kpiCards){
    kpiCards.innerHTML = '';
    [
      ['Total de Atendimentos', stats.totalTickets, 'd-abertas'],
      ['Atendimentos Abertos', stats.ticketsAbertos, 'd-atend'],
      ['Em Atendimento', stats.ticketsAtendimento, 'd-prog'],
      ['Concluídos', stats.ticketsConcluidos, 'd-concluido'],
      ['Total de Ordens', stats.totalOrdens, 'd-total'],
      ['Ordens Abertas', stats.ordensAbertas, 'd-abertas'],
      ['Ordens Atrasadas', stats.ordensAtrasadas, 'd-atraso'],
      ['Ordens Concluídas', stats.ordensConcluidas, 'd-concluido'],
    ].forEach(([lbl,val,klass])=>{
      kpiCards.appendChild(h('div',{class:`dashcard ${klass}`},[
        h('div',{},lbl),
        h('div',{}, String(val))
      ]));
    });
  }

  // Gráfico de atendimentos por módulo
  renderModulosChart();
  
  // Gráfico de ordens por status
  renderOrdensChart();
}

function renderModulosChart(){
  const ctx = $('#chartModulos');
  if (!ctx) return;

  const modCount = {};
  state.tickets.forEach(t=>{
    const m = t.modulo || 'Outros';
    modCount[m] = (modCount[m]||0) + 1;
  });

  // Limpar canvas
  ctx.width = ctx.width;

  // Desenhar gráfico simples de barras
  const mods = Object.keys(modCount);
  const vals = Object.values(modCount);
  const maxVal = Math.max(...vals, 1);
  const w = ctx.width, h = ctx.height;
  const barW = (w - 40) / mods.length;

  const ctx2d = ctx.getContext('2d');
  ctx2d.clearRect(0,0,w,h);

  // Barras
  mods.forEach((m,i)=>{
    const barH = (vals[i]/maxVal) * (h-40);
    const x = 20 + i*barW;
    const y = h - 20 - barH;

    ctx2d.fillStyle = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6'][i%5];
    ctx2d.fillRect(x, y, barW-10, barH);

    // Rótulo
    ctx2d.fillStyle = '#374151';
    ctx2d.font = '12px sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(m, x + (barW-10)/2, h-5);
    ctx2d.fillText(vals[i], x + (barW-10)/2, y-5);
  });
}

function renderOrdensChart(){
  const ctx = $('#chartOrdens');
  if (!ctx) return;

  const statusCount = {
    aberta: state.ordens.filter(o=>o.status==='aberta').length,
    andamento: state.ordens.filter(o=>o.status==='andamento').length,
    pausada: state.ordens.filter(o=>o.status==='pausada').length,
    concluida: state.ordens.filter(o=>o.status==='concluida').length,
    cancelada: state.ordens.filter(o=>o.status==='cancelada').length,
  };

  // Limpar canvas
  ctx.width = ctx.width;

  const statuses = Object.keys(statusCount);
  const vals = Object.values(statusCount);
  const total = vals.reduce((a,b)=>a+b,0) || 1;

  const ctx2d = ctx.getContext('2d');
  const w = ctx.width, h = ctx.height;
  const centerX = w/2, centerY = h/2;
  const radius = Math.min(w,h)/2 - 20;

  let startAngle = 0;
  const colors = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6'];

  statuses.forEach((s,i)=>{
    const sliceAngle = (vals[i]/total) * 2 * Math.PI;
    
    ctx2d.beginPath();
    ctx2d.moveTo(centerX, centerY);
    ctx2d.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx2d.closePath();
    
    ctx2d.fillStyle = colors[i%colors.length];
    ctx2d.fill();

    // Rótulo
    const midAngle = startAngle + sliceAngle/2;
    const labelX = centerX + (radius+15) * Math.cos(midAngle);
    const labelY = centerY + (radius+15) * Math.sin(midAngle);
    
    ctx2d.fillStyle = '#374151';
    ctx2d.font = '12px sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(`${s} (${vals[i]})`, labelX, labelY);

    startAngle += sliceAngle;
  });
}

/* ==========================================================================
   9) CONFIGURAÇÕES
   ========================================================================== */

function initConfig(){
  // Módulos
  const modList = $('#modList');
  const modInput = $('#modulo');
  if (modList){
    modList.innerHTML = '';
    state.cad.modulos.forEach(m=>{
      modList.appendChild(h('li',{},[
        h('span',{}, m),
        h('button',{class:'btn sm excluir', onClick:()=>delModulo(m)},'Excluir')
      ]));
    });
  }

  on($('#addModulo'), 'click', ()=>{
    const val = modInput.value.trim();
    if (!val) return;
    if (state.cad.modulos.includes(val)){
      alert('Módulo já existe.');
      return;
    }
    state.cad.modulos.push(val);
    persist();
    initConfig();
    modInput.value = '';
  });

  // Motivos
  const motList = $('#motList');
  const motInput = $('#motivo');
  if (motList){
    motList.innerHTML = '';
    state.cad.motivos.forEach(m=>{
      motList.appendChild(h('li',{},[
        h('span',{}, m),
        h('button',{class:'btn sm excluir', onClick:()=>delMotivo(m)},'Excluir')
      ]));
    });
  }

  on($('#addMotivo'), 'click', ()=>{
    const val = motInput.value.trim();
    if (!val) return;
    if (state.cad.motivos.includes(val)){
      alert('Motivo já existe.');
      return;
    }
    state.cad.motivos.push(val);
    persist();
    initConfig();
    motInput.value = '';
  });

  // Configurações de UI
  const ovChk = $('#ovHighlight');
  if (ovChk) ovChk.checked = state.ui.overdueHighlight;
  on(ovChk, 'change', ()=> {
    state.ui.overdueHighlight = ovChk.checked;
    persist();
  });
}

function delModulo(m){
  state.cad.modulos = state.cad.modulos.filter(x=>x!==m);
  persist();
  initConfig();
}

function delMotivo(m){
  state.cad.motivos = state.cad.motivos.filter(x=>x!==m);
  persist();
  initConfig();
}

/* ==========================================================================
   10) ASSISTENTE DE CÁLCULOS TRABALHISTAS
   ========================================================================== */

function renderAssistente() {
  console.log('Assistente carregado');
}

/* ==========================================================================
   11) INICIALIZAÇÃO GERAL
   ========================================================================== */

function init(){
  console.log('🚀 Inicializando SOFT-ATA...');
  
  // 1) Tema e relógio
  initClock();
  initThemeToggle();
  
  // 2) Perfil
  initProfileModal();
  applyHeaderProfile();
  
  // 3) Navegação
  initSidebar();
  initTabs();
  
  // 4) Módulos principais
  initCalendarForm();
  initClientesForm();
  initAtendimentoForm();
  initKanbanDnD();
  initOrdensForm();
  
  // 5) Utilitários
  initUtilDateConverter();
  initWhatsAppGenerator();
  
  // 6) Renderização inicial
  renderHome();
  renderKanban();
  renderClientes();
  renderOrdens();
  renderKPIs();
  
  console.log('✅ SOFT-ATA inicializado com sucesso!');
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}