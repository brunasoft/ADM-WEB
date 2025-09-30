// /api/atendimentos.js
import { sql } from './_db.js';

function bad(res, msg = 'Requisição inválida', code = 400) {
  return res.status(code).json({ error: msg });
}

// Normaliza string de data "YYYY-MM-DD" (ou null)
const normDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function handler(req, res) {
  try {
    // GET /api/atendimentos?q=texto&col=aberto|atendimento|...
    if (req.method === 'GET') {
      const q = (req.query?.q || '').trim();
      const col = (req.query?.col || '').trim();

      // Filtro básico
      const where = [];
      if (q) {
        // busca em título, motivo, solicitante e nome/codigo do cliente
        where.push(sql`(
          a.titulo ilike ${'%' + q + '%'} or
          a.motivo ilike ${'%' + q + '%'} or
          a.solicitante ilike ${'%' + q + '%'} or
          c.nome ilike ${'%' + q + '%'} or
          c.codigo ilike ${'%' + q + '%'}
        )`);
      }
      if (col) where.push(sql`a.col = ${col}`);

      const cond = where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;

      const rows = await sql`
        select
          a.*,
          c.codigo,
          c.nome
        from atendimentos a
        left join clientes c on c.id = a.cliente_id
        ${cond}
        order by a.created_at desc
        limit 500
      `;
      return res.json(rows);
    }

    // POST /api/atendimentos  (upsert)
    // body: { id, cliente_id, titulo, modulo, motivo, data, solicitante, col, problem, solution }
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.id || !b.titulo) {
        return bad(res, 'Informe ao menos id e titulo');
      }

      const row = await sql`
        insert into atendimentos (id, cliente_id, titulo, modulo, motivo, data, solicitante, col, problem, solution)
        values (
          ${b.id},
          ${b.cliente_id || null},
          ${b.titulo},
          ${b.modulo || null},
          ${b.motivo || null},
          ${normDate(b.data)},
          ${b.solicitante || null},
          ${b.col || 'aberto'},
          ${b.problem || null},
          ${b.solution || null}
        )
        on conflict (id) do update set
          cliente_id  = excluded.cliente_id,
          titulo      = excluded.titulo,
          modulo      = excluded.modulo,
          motivo      = excluded.motivo,
          data        = excluded.data,
          solicitante = excluded.solicitante,
          col         = excluded.col,
          problem     = excluded.problem,
          solution    = excluded.solution
        returning *;
      `;

      // anexa nome/codigo do cliente para a UI ficar completa
      const withClient = await sql`
        select a.*, c.codigo, c.nome
        from atendimentos a
        left join clientes c on c.id = a.cliente_id
        where a.id = ${b.id}
      `;
      return res.status(201).json(withClient[0] || row[0]);
    }

    // PATCH /api/atendimentos  (atualiza campos pontuais – usamos para mover colunas)
    // body: { id, ...campos }
    if (req.method === 'PATCH') {
      const b = req.body || {};
      if (!b.id) return bad(res, 'Informe id');

      // monte dinamicamente os campos que chegaram
      const sets = [];
      if ('cliente_id'  in b) sets.push(sql`cliente_id = ${b.cliente_id || null}`);
      if ('titulo'      in b) sets.push(sql`titulo = ${b.titulo}`);
      if ('modulo'      in b) sets.push(sql`modulo = ${b.modulo || null}`);
      if ('motivo'      in b) sets.push(sql`motivo = ${b.motivo || null}`);
      if ('data'        in b) sets.push(sql`data = ${normDate(b.data)}`);
      if ('solicitante' in b) sets.push(sql`solicitante = ${b.solicitante || null}`);
      if ('col'         in b) sets.push(sql`col = ${b.col}`);
      if ('problem'     in b) sets.push(sql`problem = ${b.problem || null}`);
      if ('solution'    in b) sets.push(sql`solution = ${b.solution || null}`);

      if (!sets.length) return bad(res, 'Nada para atualizar');

      const row = await sql`
        update atendimentos
           set ${sql.join(sets, sql`, `)}
         where id = ${b.id}
     returning *;
      `;

      const withClient = await sql`
        select a.*, c.codigo, c.nome
        from atendimentos a
        left join clientes c on c.id = a.cliente_id
        where a.id = ${b.id}
      `;
      return res.json(withClient[0] || row[0]);
    }

    // DELETE /api/atendimentos?id=...
    if (req.method === 'DELETE') {
      const id = (req.query?.id || '').trim();
      if (!id) return bad(res, 'Informe id');
      await sql`delete from atendimentos where id = ${id};`;
      return res.json({ ok: true, id });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return bad(res, 'Método não suportado', 405);
  } catch (e) {
    console.error('[atendimentos] ', e);
    res.status(500).json({ error: e.message || String(e) });
  }
}
