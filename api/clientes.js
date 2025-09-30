// api/clientes.js
import { sql } from './_db.js';

function bad(res, msg, code = 400) { return res.status(code).json({ error: msg }); }

export default async function handler(req, res) {
  // LISTAR (com busca opcional)
  if (req.method === 'GET') {
    const q = (req.query.q || '').toString().trim().toLowerCase();

    try {
      const rows = q
        ? await sql`
            select id, codigo as code, nome as name, status,
                   contato as contact, telefone as phone, email, endereco as address, created_at
              from clientes
             where lower(codigo) like ${'%' + q + '%'}
                or lower(nome)   like ${'%' + q + '%'}
                or lower(coalesce(contato,'')) like ${'%' + q + '%'}
             order by
               case
                 when regexp_replace(codigo, '\D', '', 'g') ~ '^[0-9]+$'
                 then (regexp_replace(codigo, '\D', '', 'g'))::int
                 else null
               end nulls last,
               codigo asc,
               created_at desc
          `
        : await sql`
            select id, codigo as code, nome as name, status,
                   contato as contact, telefone as phone, email, endereco as address, created_at
              from clientes
             order by
               case
                 when regexp_replace(codigo, '\D', '', 'g') ~ '^[0-9]+$'
                 then (regexp_replace(codigo, '\D', '', 'g'))::int
                 else null
               end nulls last,
               codigo asc,
               created_at desc
          `;
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }

  // CRIAR ou ATUALIZAR (upsert por id)
  if (req.method === 'POST') {
    const b = req.body || (await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d||'{}')))}));
    if (!b?.code || !b?.name) return bad(res, 'code e name são obrigatórios');

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
      if (msg.includes('unique') && msg.includes('codigo')) {
        return bad(res, 'Já existe um cliente com este código.', 409);
      }
      return res.status(500).json({ error: msg });
    }
  }

  // ATUALIZAR (simples – exige todos os campos)
  if (req.method === 'PATCH') {
    const b = req.body || (await new Promise(r=>{let d='';req.on('data',c=>d+=c);req.on('end',()=>r(JSON.parse(d||'{}')))}));
    if (!b?.id) return bad(res, 'id é obrigatório');

    try {
      await sql`
        update clientes
           set codigo   = ${b.code},
               nome     = ${b.name},
               status   = ${b.status},
               contato  = ${b.contact},
               telefone = ${b.phone},
               email    = ${b.email},
               endereco = ${b.address}
         where id = ${b.id}
      `;
      return res.json({ ok: true });
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('unique') && msg.includes('codigo')) {
        return bad(res, 'Já existe um cliente com este código.', 409);
      }
      return res.status(500).json({ error: msg });
    }
  }

  // EXCLUIR
  if (req.method === 'DELETE') {
    const id = (req.query.id || '').toString();
    if (!id) return bad(res, 'id é obrigatório');
    try {
      await sql`delete from clientes where id = ${id}`;
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
  res.status(405).end('Method Not Allowed');
}
