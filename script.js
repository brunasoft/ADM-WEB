/* ==========================================================================
   SOFT-ATA — script.js (COMPLETO E CORRIGIDO)
   ========================================================================== */

/* ==========================================================================
   0) HELPERS
   ========================================================================== */

// ==== Persistência de ORDENS (Neon via /api/ordens) ====
async function carregarOrdensDoBanco(){
  try{
    const ordens = await apiGet('/api/ordens');
    state.ordens = (ordens || []).map(o => ({
      id: o.id,
      numero: o.numero,
      titulo: o.titulo,
      status: o.status || 'Lançado',
      previsto: o.previsto || null,
      created_at: o.created_at
    }));
    renderOrdens();
  }catch(err){
    console.warn('[DB] Falha ao carregar ordens:', err.message);
  }
}

// ==== Persistência de ATENDIMENTOS (Neon via /api/atendimentos) ====
async function carregarAtendimentosDoBanco(){
  try{
    const list = await apiGet('/api/atendimentos');
    state.tickets = (list || []).map(a => ({
      id: a.id,
      titulo: a.titulo,
      modulo: a.modulo || '',
      motivo: a.motivo || '',
      data: a.data || '',
      solicitante: a.solicitante || '',
      col: a.col || 'aberto',
      clienteId: a.cliente_id,
      codigo: a.codigo || '',
      nome: a.nome || '',
      problem: a.problem || '',
      solution: a.solution || ''
    }));
    persist();
    renderKanban();
  }catch(e){
    console.warn('[DB] Falha ao carregar atendimentos:', e.message);
  }
}

// ==== Persistência de CLIENTES (Neon via /api/clientes) ====
async function carregarClientesDoBanco(){
  try {
    const cli = await apiGet('/api/clientes');
    state.clientes = cli || [];
    persist(); 
    renderClientes();
    if (state.ui.currentTab === 'fila') renderKanban();
  } catch (e) {
    console.warn('[DB] Falha ao carregar clientes:', e.message);
  }
}

async function salvarClienteNoBanco(c){
  return apiPost('/api/clientes', c);
}

async function excluirClienteNoBanco(id){
  return apiDelete(`/api/clientes?id=${encodeURIComponent(id)}`);
}

async function salvarAtendimentoNoBanco(t){
  return apiPost('/api/atendimentos', {
    id: t.id,
    cliente_id: t.clienteId,
    titulo: t.titulo,
    modulo: t.modulo,
    motivo: t.motivo,
    data: t.data || null,
    solicitante: t.solicitante || null,
    col: t.col,
    problem: t.problem || '',
    solution: t.solution || ''
  });
}

async function salvarOrdemNoBanco({ id, numero, titulo, status='Lançado', previsto=null }){
  return apiPost('/api/ordens', { id, numero, titulo, status, previsto });
}

// ==== HTTP helpers ====
async function apiPost(path, data){
  const r = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok) throw new Error(j.error || `POST ${path} falhou`);
  return j;
}

async function apiGet(path){
  const r = await fetch(path);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `GET ${path} falhou`);
  return j;
}

async function apiDelete(path){
  const r = await fetch(path, { method: 'DELETE' });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok) throw new Error(j.error || `DELETE ${path} falhou`);
  return j;
}

async function apiPatch(path, data){
  const r = await fetch(path, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  const j = await r.json().catch(()=> ({}));
  if (!r.ok) throw new Error(j.error || `PATCH ${path} falhou`);
  return j;
}

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

  try{
    await excluirClienteNoBanco(id);
  }catch(e){
    console.error('[DB] Erro ao excluir cliente:', e);
    alert('Não foi possível excluir o cliente no banco.');
    state.clientes.push(bak);
    persist();
    renderClientes();
  }
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

      salvarClienteNoBanco({
        id: alvo.id,
        codigo: alvo.codigo || '',
        nome: alvo.nome,
        telefone: alvo.telefone || '',
        responsavel: alvo.responsavel || ''
      }).catch(e=>{
        console.error('[DB] salvar cliente (edit):', e);
        alert('Não foi possível salvar no banco.');
        Object.assign(alvo, bak);
        persist(); renderClientes();
      });

    } else {
      const novo = { id: uid('cli'), nome, codigo, telefone: tel, responsavel: resp };

      state.clientes.push(novo);
      persist();
      renderClientes();

      salvarClienteNoBanco({
        id: novo.id,
        codigo: novo.codigo || '',
        nome: novo.nome,
        telefone: novo.telefone || '',
        responsavel: novo.responsavel || ''
      }).catch(e=>{
        console.error('[DB] salvar cliente (novo):', e);
        alert('Não foi possível salvar no banco.');
        state.clientes = state.clientes.filter(c => c.id !== novo.id);
        persist(); renderClientes();
      });
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
   6) ATENDIMENTO (KANBAN + MODAIS)
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
  const modSel = $('#t_modulo'), motSel = $('#t_motivo');
  if (modSel && motSel){
    modSel.innerHTML = '<option value="">Módulo</option>' + 
      state.cad.modulos.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
    motSel.innerHTML = '<option value="">Motivo</option>' + 
      state.cad.motivos.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  }

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

  COLS.forEach(col => {
    const list = $(`#col-${col}`);
    if (!list) return;
    list.innerHTML = '';

    const items = state.tickets.filter(t => t.col === col);
    if (!items.length){
      list.appendChild(h('div', {class: 'chip'}, 'Vazio'));
      return;
    }

    items.forEach(t => {
      const card = cloneTpl('ticketCardTpl');
      if (!card) return;

      card.dataset.id = t.id;
      card.dataset.status = col;

      const tituloCliente = (t.codigo || t.nome) 
        ? `${t.codigo || '—'} — ${t.nome || '—'}` 
        : (t.titulo || 'Sem cliente');
      
      card.querySelector('[data-bind="clienteTitulo"]').textContent = tituloCliente;
      card.querySelector('[data-bind="modulo"]').textContent = t.modulo || '—';
      card.querySelector('[data-bind="motivo"]').textContent = t.motivo || '—';
      card.querySelector('[data-bind="data"]').textContent = t.data ? formatDateForDisplay(t.data) : '—';
      card.querySelector('[data-bind="solicitante"]').textContent = t.solicitante || '—';

      const assNameEl = card.querySelector('[data-bind="assigneeName"]');
      const assAvEl = card.querySelector('[data-bind="assigneeAvatar"]');
      const profile = getCurrentProfile();
      
      if (assNameEl) assNameEl.textContent = t.assigneeName || profile.firstName;
      if (assAvEl) {
        if (t.assigneeAvatar) {
          assAvEl.src = t.assigneeAvatar;
        } else if (profile.foto) {
          assAvEl.src = profile.foto;
        } else {
          const svg = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="100%" height="100%" fill="#e5e7eb"/><circle cx="16" cy="12" r="6" fill="#94a3b8"/><rect x="6" y="20" width="20" height="7" rx="3.5" fill="#cbd5e1"/></svg>');
          assAvEl.src = `data:image/svg+xml;charset=UTF-8,${svg}`;
        }
      }

      const acts = card.querySelector('[data-bind="actions"]');
      acts.innerHTML = '';
      
      const mkBtn = (cls, txt, fn) => 
        h('button', {
          class: `btn sm ${cls}`,
          onClick: (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            fn();
          }
        }, txt);

      if (col === 'concluido') {
        acts.appendChild(mkBtn('aberto reabrir', 'Reabrir', () => moveTicket(t.id, 'aberto')));
      } else {
        if (col !== 'aberto') acts.appendChild(mkBtn('aberto', 'Aberto', () => moveTicket(t.id, 'aberto')));
        if (col !== 'atendimento') acts.appendChild(mkBtn('atendimento', 'Atendimento', () => moveTicket(t.id, 'atendimento')));
        if (col !== 'aguardando') acts.appendChild(mkBtn('aguardando', 'Aguardando', () => moveTicket(t.id, 'aguardando')));
        if (col !== 'programacao') acts.appendChild(mkBtn('programacao', 'Programação', () => moveTicket(t.id, 'programacao')));
        if (col !== 'concluido') acts.appendChild(mkBtn('concluido', 'Concluir', () => moveTicket(t.id, 'concluido')));
      }

      acts.appendChild(mkBtn('excluir', 'Excluir', () => delTicket(t.id)));
      
      if (col === 'concluido') {
        acts.appendChild(mkBtn('lancar pink', 'Lançar OS', () => createOrderFromTicket(t.id)));
      }

      card.addEventListener('click', (ev) => {
        if (ev.target.closest('.actions') || ev.target.closest('button') || ev.target.closest('.btn')) return;
        openTicketModal(t.id);
      });

      list.appendChild(card);
    });
  });
}

function initKanbanClicks(){
  const root = document.querySelector('.kanban');
  if (!root) return;
  if (root.__hasKanbanDelegation) return;
  root.__hasKanbanDelegation = true;

  root.addEventListener('click', (ev) => {
    const btn  = ev.target.closest('button, .btn, [data-act]');
    const card = ev.target.closest('.ticket');
    if (!btn || !card) return;

    ev.preventDefault();
    ev.stopPropagation();

    const id = card.dataset.id;

    if (btn.classList.contains('excluir') || btn.dataset.act === 'delete' || btn.dataset.act === 'del'){
      delTicket(id); return;
    }
    if (btn.classList.contains('lancar') || btn.dataset.act === 'lancar' || btn.dataset.act === 'launch'){
      createOrderFromTicket(id); return;
    }
    if (btn.classList.contains('editar') || btn.dataset.act === 'edit'){
      openEditModal(id); return;
    }

    const targetCol =
      btn.classList.contains('aberto')       ? 'aberto' :
      btn.classList.contains('atendimento')  ? 'atendimento' :
      btn.classList.contains('aguardando')   ? 'aguardando' :
      btn.classList.contains('programacao')  ? 'programacao' :
      btn.classList.contains('concluido')    ? 'concluido' :
      btn.classList.contains('reabrir')      ? 'aberto' : null;

    if (targetCol) moveTicket(id, targetCol);
  }, true);
}

function initKanbanForm(){
  on($('#t_add'), 'click', ()=>{
    const modulo = $('#t_modulo').value;
    const motivo = $('#t_motivo').value;
    const data   = $('#t_data').value || ymd(new Date());
    const solicitante = $('#t_solicitante').value.trim();

    if (!isValidDate(data)) {
      alert('Data inválida.');
      return;
    }

    const selId = $('#t_cliente').value;
    const cli   = state.clientes.find(c => c.id === selId);
    if (!cli){
      alert('Selecione um cliente.');
      return;
    }

    const me = getCurrentProfile();
    const titulo = `${cli.codigo || ''} ${cli.nome || ''}`.trim() || 'Atendimento';

    const novo = {
      id: uid('t'),
      titulo,
      modulo,
      motivo,
      data,
      solicitante,
      col: 'aberto',
      clienteId: cli.id,
      codigo:    cli.codigo || '',
      nome:      cli.nome   || '',
      assigneeName: me.firstName,
      assigneeAvatar: me.foto,
      problem: '',
      solution: ''
    };

    state.tickets.push(novo);
    persist();
    renderKanban();

    salvarAtendimentoNoBanco(novo).catch(err=>{
      console.error('[DB] Erro ao salvar atendimento:', err);
      alert('Não foi possível salvar no banco. Verifique conexão.');
    });

    $('#t_modulo').value = '';
    $('#t_motivo').value = '';
    $('#t_solicitante').value = '';
  });
}

async function moveTicket(id, novaCol){
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  const colAnterior = t.col;
  t.col = novaCol;
  persist();
  renderKanban();

  try{
    await apiPatch('/api/atendimentos', { id, col: novaCol });
  }catch(e){
    console.error('[DB] moveTicket:', e);
    alert('Não foi possível atualizar no banco.');
    t.col = colAnterior;
    persist();
    renderKanban();
  }
}

async function delTicket(id){
  const bak = state.tickets.find(t => t.id === id);
  if (!bak) return;

  state.tickets = state.tickets.filter(t => t.id !== id);
  persist();
  renderKanban();

  try{
    await apiDelete(`/api/atendimentos?id=${encodeURIComponent(id)}`);
  }catch(e){
    console.error('[DB] delTicket:', e);
    alert('Não foi possível excluir no banco.');
    state.tickets.push(bak);
    persist();
    renderKanban();
  }
}

function openTicketModal(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  const modal = $('#ticketModal');
  if (!modal) return;

  $('#tm_id').value = t.id;
  $('#tm_titulo').value = t.titulo || '';
  $('#tm_modulo').value = t.modulo || '';
  $('#tm_motivo').value = t.motivo || '';
  $('#tm_data').value = t.data || '';
  $('#tm_solicitante').value = t.solicitante || '';
  $('#tm_problem').value = t.problem || '';
  $('#tm_solution').value = t.solution || '';

  const modSelect = $('#tm_modulo');
  const motSelect = $('#tm_motivo');
  
  if (modSelect) {
    modSelect.innerHTML = '<option value="">Selecione...</option>' + 
      state.cad.modulos.map(m => `<option value="${esc(m)}" ${m === t.modulo ? 'selected' : ''}>${esc(m)}</option>`).join('');
  }
  
  if (motSelect) {
    motSelect.innerHTML = '<option value="">Selecione...</option>' + 
      state.cad.motivos.map(m => `<option value="${esc(m)}" ${m === t.motivo ? 'selected' : ''}>${esc(m)}</option>`).join('');
  }

  modal.hidden = false;
  setupTicketModalEvents(modal, id);
}

function setupTicketModalEvents(modal, ticketId) {
  const closeBtn = modal.querySelector('[data-close]');
  const backdrop = modal.querySelector('.modal__backdrop');
  const editBtn = $('#tm_edit');
  const saveBtn = $('#tm_save');
  const delBtn = $('#tm_del');

  const closeModal = () => {
    modal.hidden = true;
  };

  const handleEsc = (e) => {
    if (e.key === 'Escape') closeModal();
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (backdrop) backdrop.onclick = closeModal;

  if (editBtn) {
    editBtn.onclick = () => {
      closeModal();
      openEditModal(ticketId);
    };
  }

  if (saveBtn) {
    saveBtn.onclick = () => {
      saveTicketModal(ticketId);
      closeModal();
    };
  }

  if (delBtn) {
    delBtn.onclick = () => {
      if (confirm('Tem certeza que deseja excluir este atendimento?')) {
        delTicket(ticketId);
        closeModal();
      }
    };
  }

  document.addEventListener('keydown', handleEsc);
  modal._escHandler = handleEsc;
}

function saveTicketModal(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  const bak = {...t};

  t.titulo = $('#tm_titulo').value.trim();
  t.modulo = $('#tm_modulo').value;
  t.motivo = $('#tm_motivo').value;
  t.data = $('#tm_data').value;
  t.solicitante = $('#tm_solicitante').value.trim();
  t.problem = $('#tm_problem').value.trim();
  t.solution = $('#tm_solution').value.trim();

  persist();
  renderKanban();

  salvarAtendimentoNoBanco(t).catch(err => {
    console.error('[DB] saveTicketModal:', err);
    alert('Não foi possível salvar no banco.');
    Object.assign(t, bak);
    persist();
    renderKanban();
  });

  alert('Atendimento salvo com sucesso!');
}

function openEditModal(id) {
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  const modal = $('#editModal');
  if (!modal) return;

  $('#e_ticket_id').value = t.id;
  $('#e_titulo').value = t.titulo || '';
  $('#e_modulo').value = t.modulo || '';
  $('#e_motivo').value = t.motivo || '';
  $('#e_data').value = t.data || '';

  const modSelect = $('#e_modulo');
  const motSelect = $('#e_motivo');
  
  if (modSelect) {
    modSelect.innerHTML = '<option value="">Selecione...</option>' + 
      state.cad.modulos.map(m => `<option value="${esc(m)}" ${m === t.modulo ? 'selected' : ''}>${esc(m)}</option>`).join('');
  }
  
  if (motSelect) {
    motSelect.innerHTML = '<option value="">Selecione...</option>' + 
      state.cad.motivos.map(m => `<option value="${esc(m)}" ${m === t.motivo ? 'selected' : ''}>${esc(m)}</option>`).join('');
  }

  modal.hidden = false;

  const closeModal = () => modal.hidden = true;
  const handleEsc = (e) => { if (e.key === 'Escape') closeModal(); };

  on($('#e_cancel'), 'click', closeModal);
  on($('#e_save'), 'click', saveEditModal);
  on(modal.querySelector('.modal__backdrop'), 'click', closeModal);
  document.addEventListener('keydown', handleEsc);
}

function saveEditModal() {
  const id = $('#e_ticket_id').value;
  const t = state.tickets.find(x => x.id === id);
  if (!t) return;

  const bak = {...t};

  t.titulo = $('#e_titulo').value.trim();
  t.modulo = $('#e_modulo').value;
  t.motivo = $('#e_motivo').value;
  t.data = $('#e_data').value;

  persist();
  renderKanban();

  salvarAtendimentoNoBanco(t).catch(err => {
    console.error('[DB] saveEditModal:', err);
    alert('Não foi possível salvar no banco.');
    Object.assign(t, bak);
    persist();
    renderKanban();
  });

  $('#editModal').hidden = true;
  alert('Atendimento atualizado com sucesso!');
}

function createOrderFromTicket(ticketId) {
  const t = state.tickets.find(x => x.id === ticketId);
  if (!t) return;

  const modal = $('#launchModal');
  if (!modal) return;

  $('#m_ticket_id').value = ticketId;
  $('#m_problem').value = t.problem || '';
  $('#m_solution').value = t.solution || '';

  modal.hidden = false;

  const closeModal = () => modal.hidden = true;
  const handleEsc = (e) => { if (e.key === 'Escape') closeModal(); };

  on($('#m_cancel'), 'click', closeModal);
  on($('#m_save'), 'click', saveOrderFromTicket);
  on(modal.querySelector('.modal__backdrop'), 'click', closeModal);
  document.addEventListener('keydown', handleEsc);
}

function saveOrderFromTicket() {
  const ticketId = $('#m_ticket_id').value;
  const t = state.tickets.find(x => x.id === ticketId);
  if (!t) return;

  const problem = $('#m_problem').value.trim();
  const solution = $('#m_solution').value.trim();

  if (!problem) {
    alert('Informe o problema antes de lançar a ordem.');
    return;
  }

  t.problem = problem;
  t.solution = solution;

  const nextNum = state.ordens.length + 1;
  const numero = `OS${String(nextNum).padStart(3, '0')}`;
  
  const nova = {
    id: uid('os'),
    numero,
    titulo: t.titulo || 'Ordem de Serviço',
    status: 'Lançado',
    previsto: ymd(new Date()),
    created_at: new Date().toISOString(),
    ticket_origin: ticketId
  };

  state.ordens.push(nova);
  persist();
  renderOrdens();

  Promise.all([
    salvarAtendimentoNoBanco(t),
    salvarOrdemNoBanco(nova)
  ]).catch(err => {
    console.error('[DB] saveOrderFromTicket:', err);
    alert('Não foi possível salvar no banco.');
    state.ordens = state.ordens.filter(o => o.id !== nova.id);
    persist();
    renderOrdens();
  });

  $('#launchModal').hidden = true;
  moveTicket(ticketId, 'concluido');
}

/* ==========================================================================
   7) ORDENS DE SERVIÇO
   ========================================================================== */

function isAtrasada(previsto){
  if (!previsto) return false;
  const hoje = ymd(new Date());
  return previsto < hoje;
}

function renderOrdens(){
  const tb = $('#tblOrdens');
  if (!tb) return;
  tb.innerHTML = '';

  if (!state.ordens.length){
    tb.appendChild(h('tr',{}, h('td',{colspan:'5'},'Nenhuma ordem cadastrada.')));
    return;
  }

  state.ordens.forEach(o=>{
    const atrasada = isAtrasada(o.previsto);
    const tr = h('tr', {class: atrasada ? 'atrasada' : ''}, [
      h('td',{}, o.numero||'—'),
      h('td',{}, o.titulo||'—'),
      h('td',{}, o.status||'—'),
      h('td',{}, o.previsto ? brDate(o.previsto) : '—'),
      h('td',{}, [
        h('button',{class:'btn sm editar', onClick:()=>editOrdem(o.id)},'Editar'),
        h('button',{class:'btn sm excluir', onClick:()=>delOrdem(o.id)},'Excluir'),
      ])
    ]);
    tb.appendChild(tr);
  });
}

function editOrdem(id){
  const o = state.ordens.find(x=>x.id===id);
  if (!o) return;
  $('#o_edit_id').value = o.id;
  $('#o_edit_numero').value = o.numero || '';
  $('#o_edit_titulo').value = o.titulo || '';
  $('#o_edit_status').value = o.status || 'Lançado';
  $('#o_edit_previsto').value = o.previsto || '';
  $('#editOrderModal').classList.add('open');
}

function delOrdem(id){
  const bak = state.ordens.find(o=>o.id===id);
  if (!bak) return;

  state.ordens = state.ordens.filter(o=>o.id!==id);
  persist();
  renderOrdens();

  apiDelete(`/api/ordens?id=${encodeURIComponent(id)}`).catch(e=>{
    console.error('[DB] delOrdem:', e);
    alert('Não foi possível excluir no banco.');
    state.ordens.push(bak);
    persist();
    renderOrdens();
  });
}

function initOrdensForm(){
  on($('#o_add'), 'click', ()=>{
    const numero = $('#o_numero').value.trim();
    const titulo = $('#o_titulo').value.trim();
    const status = $('#o_status').value || 'Lançado';
    const previsto = $('#o_previsto').value;

    if (!numero || !titulo){
      alert('Informe número e título.');
      return;
    }

    const nova = {
      id: uid('os'),
      numero,
      titulo,
      status,
      previsto: previsto || null,
      created_at: new Date().toISOString()
    };

    state.ordens.push(nova);
    persist();
    renderOrdens();

    salvarOrdemNoBanco(nova).catch(err=>{
      console.error('[DB] initOrdensForm:', err);
      alert('Não foi possível salvar no banco.');
      state.ordens = state.ordens.filter(o => o.id !== nova.id);
      persist();
      renderOrdens();
    });

    $('#o_numero').value = '';
    $('#o_titulo').value = '';
    $('#o_status').value = 'Lançado';
    $('#o_previsto').value = '';
  });

  on($('#o_edit_save'), 'click', ()=>{
    const id = $('#o_edit_id').value;
    const o = state.ordens.find(x=>x.id===id);
    if (!o) return;

    const bak = {...o};
    o.numero   = $('#o_edit_numero').value.trim();
    o.titulo   = $('#o_edit_titulo').value.trim();
    o.status   = $('#o_edit_status').value;
    o.previsto = $('#o_edit_previsto').value || null;

    persist();
    renderOrdens();

    salvarOrdemNoBanco(o).catch(err=>{
      console.error('[DB] editOrdem:', err);
      alert('Não foi possível salvar no banco.');
      Object.assign(o, bak);
      persist();
      renderOrdens();
    });

    $('#editOrderModal').classList.remove('open');
  });

  on($('#o_edit_close'), 'click', ()=> $('#editOrderModal').classList.remove('open'));
}

/* ==========================================================================
   8) DASHBOARD (KPIs)
   ========================================================================== */

function renderKPIs(){
  const cont = $('#kpis');
  if (!cont) return;

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const atendMes = state.tickets.filter(t=>{
    const dt = new Date(t.data || '');
    return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
  }).length;

  const ordensAtrasadas = state.ordens.filter(o=> isAtrasada(o.previsto)).length;
  const ordensMes = state.ordens.filter(o=>{
    const dt = new Date(o.created_at || '');
    return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual;
  }).length;

  const clientesAtivos = [...new Set(state.tickets.map(t=>t.clienteId))].length;

  cont.innerHTML = '';
  [
    ['Atendimentos (mês)', atendMes, 'd-atend'],
    ['OS Emitidas (mês)', ordensMes, 'd-prog'],
    ['OS Atrasadas', ordensAtrasadas, 'd-atraso'],
    ['Clientes Ativos', clientesAtivos, 'd-abertas'],
  ].forEach(([lbl,val,klass])=>{
    cont.appendChild(h('div',{class:`kpi ${klass}`},[
      h('h3',{},lbl),
      h('div',{class:'num'}, String(val))
    ]));
  });
}

/* ==========================================================================
   9) CONFIGURAÇÕES
   ========================================================================== */

function initConfig(){
  $('#cfg_modulos').value = state.cad.modulos.join('\n');
  $('#cfg_motivos').value = state.cad.motivos.join('\n');
  $('#cfg_overdue').checked = state.ui.overdueHighlight;
  
  const statusChips = $('#cfg_status');
  if (statusChips) {
    statusChips.innerHTML = `
      <span class="chip">Aberto</span>
      <span class="chip">Em atendimento</span>
      <span class="chip">Aguardando</span>
      <span class="chip">Programação</span>
      <span class="chip">Concluído</span>
    `;
  }
  
  on($('#cfg_save_modmot'), 'click', () => {
    const modulos = $('#cfg_modulos').value.split('\n').map(m => m.trim()).filter(Boolean);
    const motivos = $('#cfg_motivos').value.split('\n').map(m => m.trim()).filter(Boolean);
    
    if (modulos.length) state.cad.modulos = modulos;
    if (motivos.length) state.cad.motivos = motivos;
    
    persist();
    alert('Módulos e motivos salvos!');
  });
  
  on($('#cfg_save'), 'click', () => {
    state.ui.overdueHighlight = $('#cfg_overdue').checked;
    persist();
    alert('Configurações salvas!');
  });
}

/* ==========================================================================
   10) ASSISTENTE DE CÁLCULOS (CORRIGIDO)
   ========================================================================== */

function initAssistenteTabs(){
  const tabs = $$('.assist-tab');
  const panes = $$('.assist-pane');
  const resultBoxes = $$('.result-box');

  const show = (key) => {
    tabs.forEach(t => {
      const on = t.dataset.tab === key;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    
    panes.forEach(p => p.hidden = (p.id !== `pane-${key}`));
    resultBoxes.forEach(box => box.hidden = (box.id !== `result-${key}`));
  };

  tabs.forEach(t => on(t, 'click', () => show(t.dataset.tab)));
  show('folha');

  // Atualizar parâmetros
  const P = ASSIST_PARAM;
  if ($('#p_min')) $('#p_min').textContent = fmtBRL(P.salarioMin);
  if ($('#p_teto')) $('#p_teto').textContent = fmtBRL(P.tetoINSS);
  if ($('#p_fgts')) $('#p_fgts').textContent = (P.fgts * 100).toFixed(1) + '%';
  if ($('#p_fam')) {
    $('#p_fam').textContent = `teto ${fmtBRL(P.familia.teto)} / ${fmtBRL(P.familia.valor)} por dep.`;
  }
}

function initAssistenteFolha(){
  const btn = $('#btnCalcularFolha');
  if (!btn) return;

  on(btn, 'click', () => {
    const salario = Number($('#f-salario')?.value || 0);
    const outras = Number($('#f-outras')?.value || 0);
    const dep = Number($('#f-dependentes')?.value || 0);
    const compKey = $('#f-competencia')?.value === '2025-04' ? 'jan-abr-2025' : 'maio-2025';
    const simp = ($('#f-simplificado')?.value === 'sim');

    if (!salario) {
      alert('Informe o salário base.');
      return;
    }

    const baseINSS = salario + outras;
    const rINSS = calcINSS_progressivo(baseINSS);
    const fgts = calcFGTS(salario + outras);
    const baseIR = (salario + outras) - rINSS.inss;
    const rIR = calcIRRF(baseIR, dep, compKey, simp);
    
    // Salário-família
    const familia = (salario <= ASSIST_PARAM.familia.teto) ? 
      (ASSIST_PARAM.familia.valor * dep) : 0;

    const descontos = rINSS.inss + rIR.irrf;
    const proventos = salario + outras + familia;
    const liquido = proventos - descontos;

    // Atualizar resultados
    if ($('#r-base-inss')) $('#r-base-inss').textContent = fmtBRL(baseINSS);
    if ($('#r-inss')) $('#r-inss').textContent = fmtBRL(rINSS.inss);
    if ($('#r-base-fgts')) $('#r-base-fgts').textContent = fmtBRL(salario + outras);
    if ($('#r-fgts')) $('#r-fgts').textContent = fmtBRL(fgts);
    if ($('#r-base-irrf')) $('#r-base-irrf').textContent = fmtBRL(rIR.base);
    if ($('#r-irrf')) $('#r-irrf').textContent = fmtBRL(rIR.irrf);
    if ($('#r-salario-familia')) $('#r-salario-familia').textContent = fmtBRL(familia);
    if ($('#r-descontos')) $('#r-descontos').textContent = fmtBRL(descontos);
    if ($('#r-proventos')) $('#r-proventos').textContent = fmtBRL(proventos);
    if ($('#r-liquido')) $('#r-liquido').textContent = fmtBRL(liquido);

    // Atualizar totais
    if ($('#sum-folha-liq')) $('#sum-folha-liq').textContent = fmtBRL(liquido);
    if ($('#sum-folha-desc')) $('#sum-folha-desc').textContent = fmtBRL(descontos);
    if ($('#sum-folha-prov')) $('#sum-folha-prov').textContent = fmtBRL(proventos);
    if ($('#sum-folha-fgts')) $('#sum-folha-fgts').textContent = fmtBRL(fgts);
    
    updateTotalGeral();
  });

  // Botão limpar
  on($('#btnLimparFolha'), 'click', () => {
    $('#f-salario').value = '';
    $('#f-outras').value = '0';
    $('#f-dependentes').value = '0';
    $('#f-competencia').value = '2025-09';
    $('#f-simplificado').value = 'nao';
  });
}

function initAssistenteFerias(){
  const btn = $('#btnCalcularFerias');
  if (!btn) return;
  
  on(btn, 'click', () => {
    const sal = Number($('#fer-salario')?.value || 0);
    const dias = Number($('#fer-dias')?.value || 30);
    const abono = ($('#fer-abono')?.value === '10');
    const dep = Number($('#fer-dependentes')?.value || 0);
    const compKey = $('#fer-competencia')?.value === 'jan-abr-2025' ? 'jan-abr-2025' : 'maio-2025';

    if (!sal) {
      alert('Informe o salário base.');
      return;
    }

    // Cálculo básico das férias
    const valorFerias = sal * (dias / 30);
    const umterco = valorFerias / 3;
    const abonoVal = abono ? (sal * 10 / 30) : 0;
    const totalBruto = valorFerias + umterco + abonoVal;

    // INSS sobre férias
    const { inss } = calcINSS_progressivo(valorFerias);
    
    // IRRF sobre férias (base: valor das férias - INSS)
    const baseIR = valorFerias - inss;
    const { irrf } = calcIRRF(baseIR, dep, compKey, false);

    const totalLiquido = totalBruto - inss - irrf;

    // Atualizar resultados
    if ($('#r-ferias-valor')) $('#r-ferias-valor').textContent = fmtBRL(valorFerias);
    if ($('#r-ferias-terco')) $('#r-ferias-terco').textContent = fmtBRL(umterco);
    if ($('#r-ferias-abono')) $('#r-ferias-abono').textContent = fmtBRL(abonoVal);
    if ($('#r-ferias-inss')) $('#r-ferias-inss').textContent = fmtBRL(inss);
    if ($('#r-ferias-irrf')) $('#r-ferias-irrf').textContent = fmtBRL(irrf);
    if ($('#r-ferias-liquido')) $('#r-ferias-liquido').textContent = fmtBRL(totalLiquido);

    // Atualizar totais
    if ($('#sum-ferias-liq')) $('#sum-ferias-liq').textContent = fmtBRL(totalLiquido);
    
    updateTotalGeral();
  });

  // Botão limpar
  on($('#btnLimparFerias'), 'click', () => {
    $('#fer-salario').value = '';
    $('#fer-dias').value = '30';
    $('#fer-abono').value = '0';
    $('#fer-dependentes').value = '0';
    $('#fer-competencia').value = 'maio-2025';
  });
}

function initAssistente13(){
  const btn = $('#btnCalcular13');
  if (!btn) return;
  
  on(btn, 'click', () => {
    const sal = Number($('#d-salario')?.value || 0);
    const meses = Number($('#d-meses')?.value || 12);
    const dep = Number($('#d-dependentes')?.value || 0);
    const adiant = ($('#d-adiant')?.value === '1');
    const compKey = $('#d-competencia')?.value === 'jan-abr-2025' ? 'jan-abr-2025' : 'maio-2025';

    if (!sal) {
      alert('Informe o salário base.');
      return;
    }

    // Cálculo do 13º
    const valorBruto = sal * (meses / 12);
    const adiantamento = adiant ? valorBruto * 0.5 : 0;
    const valorSegundaParcela = valorBruto - adiantamento;

    // INSS sobre a 2ª parcela
    const { inss } = calcINSS_progressivo(valorSegundaParcela);
    
    // IRRF sobre a 2ª parcela
    const baseIR = valorSegundaParcela - inss;
    const { irrf } = calcIRRF(baseIR, dep, compKey, false);

    const segundaParcelaLiquida = valorSegundaParcela - inss - irrf;

    // Atualizar resultados
    if ($('#r-decimo-bruto')) $('#r-decimo-bruto').textContent = fmtBRL(valorBruto);
    if ($('#r-decimo-adiant')) $('#r-decimo-adiant').textContent = fmtBRL(adiantamento);
    if ($('#r-decimo-inss')) $('#r-decimo-inss').textContent = fmtBRL(inss);
    if ($('#r-decimo-irrf')) $('#r-decimo-irrf').textContent = fmtBRL(irrf);
    if ($('#r-decimo-liquido')) $('#r-decimo-liquido').textContent = fmtBRL(segundaParcelaLiquida);

    // Atualizar totais
    if ($('#sum-decimo-liq')) $('#sum-decimo-liq').textContent = fmtBRL(segundaParcelaLiquida);
    
    updateTotalGeral();
  });

  // Botão limpar
  on($('#btnLimpar13'), 'click', () => {
    $('#d-salario').value = '';
    $('#d-meses').value = '12';
    $('#d-dependentes').value = '0';
    $('#d-adiant').value = '1';
    $('#d-competencia').value = 'maio-2025';
  });
}

function initAssistenteHoras(){
  const btn = $('#btnCalcularHoras');
  if (!btn) return;
  
  on(btn, 'click', () => {
    const salario = Number($('#h-salario')?.value || 0);
    const horas = Number($('#h-horas')?.value || 0);
    const adicional = Number($('#h-adic')?.value || 0.5);

    if (!salario || !horas) {
      alert('Informe salário e horas extras.');
      return;
    }

    // Cálculo de horas extras
    const valorHora = salario / 220; // 220 horas mensais
    const valorHoraExtra = valorHora * (1 + adicional);
    const totalHorasExtras = valorHoraExtra * horas;

    // Atualizar resultados
    if ($('#r-horas-valor')) $('#r-horas-valor').textContent = fmtBRL(valorHora);
    if ($('#r-horas-adicional')) $('#r-horas-adicional').textContent = (adicional * 100) + '%';
    if ($('#r-horas-total')) $('#r-horas-total').textContent = fmtBRL(totalHorasExtras);

    // Atualizar totais
    if ($('#sum-horas')) $('#sum-horas').textContent = fmtBRL(totalHorasExtras);
    
    updateTotalGeral();
  });

  // Botão limpar
  on($('#btnLimparHoras'), 'click', () => {
    $('#h-salario').value = '';
    $('#h-horas').value = '';
    $('#h-adic').value = '0.5';
  });
}

function initAssistenteNoturno(){
  const btn = $('#btnCalcularNoturno');
  if (!btn) return;
  
  on(btn, 'click', () => {
    const salario = Number($('#n-salario')?.value || 0);
    const horas = Number($('#n-horas')?.value || 0);
    const percentual = Number($('#n-perc')?.value || 0.2);

    if (!salario || !horas) {
      alert('Informe salário e horas noturnas.');
      return;
    }

    // Cálculo do adicional noturno
    const valorHora = salario / 220;
    const valorAdicionalNoturno = valorHora * percentual;
    const totalAdicional = valorAdicionalNoturno * horas;

    // Atualizar resultados
    if ($('#r-noturno-valor')) $('#r-noturno-valor').textContent = fmtBRL(valorHora);
    if ($('#r-noturno-adicional')) $('#r-noturno-adicional').textContent = (percentual * 100) + '%';
    if ($('#r-noturno-total')) $('#r-noturno-total').textContent = fmtBRL(totalAdicional);

    // Atualizar totais
    if ($('#sum-noturno')) $('#sum-noturno').textContent = fmtBRL(totalAdicional);
    
    updateTotalGeral();
  });

  // Botão limpar
  on($('#btnLimparNoturno'), 'click', () => {
    $('#n-salario').value = '';
    $('#n-horas').value = '';
    $('#n-perc').value = '0.20';
  });
}

function initAssistenteRescisao(){
  const btn = $('#btnCalcularRescisao');
  if (!btn) return;
  
  on(btn, 'click', () => {
    const salario = Number($('#r-salario')?.value || 0);
    const meses = Number($('#r-meses')?.value || 12);
    const saldoDias = Number($('#r-saldo-dias')?.value || 0);
    const fgtsSaldo = Number($('#r-fgts-saldo')?.value || 0);
    const feriasVencidas = ($('#r-ferias-vencidas')?.value === 'sim');
    const motivo = $('#r-motivo')?.value || 'sem-justa';
    const aviso = $('#r-aviso')?.value || 'indenizado';
    const avisoDias = Number($('#r-aviso-dias')?.value || 30);

    if (!salario) {
      alert('Informe o salário base.');
      return;
    }

    // Cálculos básicos da rescisão
    const saldoSalario = salario * (saldoDias / 30);
    const decimoProporcional = salario * (meses / 12);
    const feriasProporcionais = salario * (meses / 12);
    const umTercoFerias = feriasProporcionais / 3;
    
    // Férias vencidas
    const feriasVencidasValor = feriasVencidas ? salario + (salario / 3) : 0;
    
    // Aviso prévio
    let avisoPrevio = 0;
    if (aviso === 'indenizado') {
      avisoPrevio = salario;
    } else if (aviso === 'trabalhado') {
      avisoPrevio = salario * (avisoDias / 30);
    }
    
    // Multa FGTS (40% para sem justa causa)
    const multaFGTS = motivo === 'sem-justa' ? fgtsSaldo * 0.4 : 0;

    // Totais
    const totalBruto = saldoSalario + decimoProporcional + feriasProporcionais + 
                      umTercoFerias + feriasVencidasValor + avisoPrevio + multaFGTS;

    // INSS e IRRF (cálculos simplificados)
    const { inss } = calcINSS_progressivo(totalBruto);
    const { irrf } = calcIRRF(totalBruto - inss, 0, 'maio-2025', false);

    const totalLiquido = totalBruto - inss - irrf;

    // Atualizar resultados
    if ($('#r-rescisao-saldo')) $('#r-rescisao-saldo').textContent = fmtBRL(saldoSalario);
    if ($('#r-rescisao-decimo')) $('#r-rescisao-decimo').textContent = fmtBRL(decimoProporcional);
    if ($('#r-rescisao-ferias')) $('#r-rescisao-ferias').textContent = fmtBRL(feriasProporcionais);
    if ($('#r-rescisao-terco')) $('#r-rescisao-terco').textContent = fmtBRL(umTercoFerias);
    if ($('#r-rescisao-aviso')) $('#r-rescisao-aviso').textContent = fmtBRL(avisoPrevio);
    if ($('#r-rescisao-multa')) $('#r-rescisao-multa').textContent = fmtBRL(multaFGTS);
    if ($('#r-rescisao-inss')) $('#r-rescisao-inss').textContent = fmtBRL(inss);
    if ($('#r-rescisao-irrf')) $('#r-rescisao-irrf').textContent = fmtBRL(irrf);
    if ($('#r-rescisao-liquido')) $('#r-rescisao-liquido').textContent = fmtBRL(totalLiquido);

    // Atualizar totais
    if ($('#sum-rescisao-liq')) $('#sum-rescisao-liq').textContent = fmtBRL(totalLiquido);
    if ($('#sum-rescisao-multa')) $('#sum-rescisao-multa').textContent = fmtBRL(multaFGTS);
    
    updateTotalGeral();
  });

  // Botão limpar
  on($('#btnLimparRescisao'), 'click', () => {
    $('#r-salario').value = '';
    $('#r-meses').value = '12';
    $('#r-saldo-dias').value = '0';
    $('#r-fgts-saldo').value = '';
    $('#r-ferias-vencidas').value = 'nao';
    $('#r-motivo').value = 'sem-justa';
    $('#r-aviso').value = 'indenizado';
    $('#r-aviso-dias').value = '30';
  });
}

function updateTotalGeral() {
  let total = 0;
  
  // Folha
  if ($('#include-folha')?.checked) {
    const valor = parseFloat($('#sum-folha-liq')?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || 0);
    total += isNaN(valor) ? 0 : valor;
  }
  
  // Férias
  if ($('#include-ferias')?.checked) {
    const valor = parseFloat($('#sum-ferias-liq')?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || 0);
    total += isNaN(valor) ? 0 : valor;
  }
  
  // 13º
  if ($('#include-decimo')?.checked) {
    const valor = parseFloat($('#sum-decimo-liq')?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || 0);
    total += isNaN(valor) ? 0 : valor;
  }
  
  // Horas Extras
  if ($('#include-horas')?.checked) {
    const valor = parseFloat($('#sum-horas')?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || 0);
    total += isNaN(valor) ? 0 : valor;
  }
  
  // Adicional Noturno
  if ($('#include-noturno')?.checked) {
    const valor = parseFloat($('#sum-noturno')?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || 0);
    total += isNaN(valor) ? 0 : valor;
  }
  
  // Rescisão
  if ($('#include-rescisao')?.checked) {
    const valor = parseFloat($('#sum-rescisao-liq')?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || 0);
    total += isNaN(valor) ? 0 : valor;
  }
  
  if ($('#sum-total')) {
    $('#sum-total').textContent = fmtBRL(total);
  }
}

// Inicializar eventos dos checkboxes
function initAssistenteCheckboxes() {
  const checkboxes = [
    '#include-folha', '#include-ferias', '#include-decimo',
    '#include-horas', '#include-noturno', '#include-rescisao'
  ];
  
  checkboxes.forEach(selector => {
    const checkbox = $(selector);
    if (checkbox) {
      on(checkbox, 'change', updateTotalGeral);
    }
  });
}

/* ==========================================================================
   11) UTILITÁRIOS E INICIALIZAÇÃO
   ========================================================================== */

function initDateFields() {
  const today = ymd(new Date());
  const dateFields = [
    '#t_data', '#ev_date', '#o_previsto', '#e_data', '#tm_data', '#u_dt'
  ];
  
  dateFields.forEach(selector => {
    const field = $(selector);
    if (field && !field.value) field.value = today;
  });
}

function initModalClosers() {
  $$('.modal__backdrop').forEach(backdrop => {
    on(backdrop, 'click', function() {
      this.closest('.modal').hidden = true;
    });
  });

  on(document, 'keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.modal').forEach(modal => {
        if (!modal.hidden) modal.hidden = true;
      });
    }
  });
}

/* ==========================================================================
   12) INICIALIZAÇÃO PRINCIPAL
   ========================================================================== */

async function init(){
  console.log('🚀 Iniciando SOFT-ATA...');
  
  try {
    // Inicializações básicas
    initClock();
    initThemeToggle();
    initSidebar();
    initTabs();
    initDateFields();
    initCalendarForm();
    initClientesForm();
    initKanbanClicks();
    initKanbanForm();
    initOrdensForm();
    initConfig();
    initProfileModal();
    initModalClosers();
    initWhatsAppGenerator();
    initUtilDateConverter();
    
    // Assistente
    initAssistenteTabs();
    initAssistente();
    initFerias();
    init13();
    initHoras();
    initNoturno();
    initResc();
    
    applyHeaderProfile();

    // Carregar dados do banco
    await Promise.allSettled([
      carregarClientesDoBanco(),
      carregarAtendimentosDoBanco(), 
      carregarOrdensDoBanco()
    ]);

    // Renderizar aba atual
    setTab(state.ui.currentTab);
    
    console.log('✅ SOFT-ATA totalmente funcional!');
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
  }
}

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}