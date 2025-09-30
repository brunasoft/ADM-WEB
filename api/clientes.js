import { sql } from './_db.js';

function bad(res, msg, code = 400) { return res.status(code).json({ error: msg }); }

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const q = (req.query.q || '').toString().trim();
    const orderExpr = `
      case
        when regexp_replace(codigo, '\\D', '', 'g') ~ '^[0-9]+$'
        then (regexp_replace(codigo, '\\D', '', 'g'))::int
        else null
      end
    `;
    try {
      const rows = q
        ? await sql`
            select id, codigo as code, nome as name, status,
                   contato as contact, telefone as phone, email, endereco as address, created_at
              from clientes
             where lower(codigo) like ${'%' + q.toLowerCase() + '%'}
                or lower(nome)   like ${'%' + q.toLowerCase() + '%'}
                or lower(coalesce(contato,'')) like ${'%' + q.toLowerCase() + '%'}
             order by ${sql.unsafe(orderExpr)} nulls last, codigo asc, created_at desc
          `
        : await sql`
            select id, codigo as code, nome as name, status,
                   contato as contact, telefone as phone, email, endereco as address, created_at
              from clientes
             order by ${sql.unsafe(orderExpr)} nulls last, codigo asc, created_at desc
          `;
      return res.json(rows);
    } catch (e) { return res.status(500).json({ error: String(e?.message || e) }); }
  }

  if (req.method === 'POST') {
    const b = req.body || (await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d||'{}')))}));
    if (!b?.code || !b?.name) return bad(res,'code e name são obrigatórios');
    const id = b.id || crypto.randomUUID();
    try {
      const row = (await sql`
        insert into clientes (id, codigo, nome, status, contato, telefone, email, endereco)
        values (${id}, ${b.code}, ${b.name}, ${b.status ?? 'ativo'},
                ${b.contact ?? null}, ${b.phone ?? null}, ${b.email ?? null}, ${b.address ?? null})
        on conflict (id) do update
          set codigo   = excluded.codigo,
              nome     = excluded.nome,
              status   = excluded.status,
              contato  = excluded.contato,
              telefone = excluded.telefone,
              email    = excluded.email,
              endereco = excluded.endereco
        returning id, codigo as code, nome as name, status,
                  contato as contact, telefone as phone, email, endereco as address, created_at
      `)[0];
      return res.status(201).json(row);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('unique') && msg.includes('codigo')) return bad(res,'Já existe um cliente com este código.',409);
      return res.status(500).json({ error: msg });
    }
  }

  if (req.method === 'PATCH') {
    const b = req.body || (await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d||'{}')))}));
    if (!b?.id) return bad(res,'id é obrigatório');
    const allow = { code:'codigo', name:'nome', status:'status', contact:'contato', phone:'telefone', email:'email', address:'endereco' };
    const sets = []; const vals = [];
    for (const [k,col] of Object.entries(allow)) if (k in b) { sets.push(`${col} = $${sets.length+1}`); vals.push(b[k]); }
    if (!sets.length) return bad(res,'Nada para atualizar');
    try {
      await sql.unsafe(`update clientes set ${sets.join(', ')} where id = $${sets.length+1}`, [...vals, b.id]);
      return res.json({ ok:true });
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('unique') && msg.includes('codigo')) return bad(res,'Já existe um cliente com este código.',409);
      return res.status(500).json({ error: msg });
    }
  }

  if (req.method === 'DELETE') {
    const id = (req.query.id || '').toString();
    if (!id) return bad(res,'id é obrigatório');
    try { await sql`delete from clientes where id = ${id}`; return res.json({ ok:true }); }
    catch(e) { return res.status(500).json({ error: String(e?.message || e) }); }
  }

  res.setHeader('Allow',['GET','POST','PATCH','DELETE']);
  res.status(405).end('Method Not Allowed');
}
