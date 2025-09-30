// /api/atendimentos.js
import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

// aceita vários nomes que podem existir no Vercel/Neon
const URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.ARMAZENAR_URL; // se você usou prefixo personalizado

let sql; // conexão será criada sob demanda

function bad(res, msg = 'Requisição inválida', code = 400) {
  return res.status(code).json({ error: msg });
}

// normaliza string "YYYY-MM-DD" para DATE ou null
const normDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export default async function handler(req, res) {
  // CORS simples (seguro manter mesmo em mesma origem)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!URL) {
      return res.status(500).json({ error: 'DATABASE_URL/POSTGRES_URL não configurada no Vercel' });
    }
    if (!sql) sql = neon(URL);

    // ---------- GET  ----------
    // /api/atendimentos?q=texto&col=aberto|atendimento|aguardando|programacao|concluido
    if (req.method === 'GET') {
      const q = (req.query?.q || '').trim();
      const col = (req.query?.col || '').trim();

      const where = [];
      if (q) {
        // busca por título/motivo/solicitante e também por cliente (nome/código)
        where.push(
          sql`(a.titulo ilike ${'%' + q + '%'}
             or a.motivo ilike ${'%' + q + '%'}
             or a.solicitante ilike ${'%' + q + '%'}
             or c.nome ilike ${'%' + q + '%'}
             or c.codigo ilike ${'%' + q + '%'})`
        );
      }
      if (col) where.push(sql`a.col = ${col}`);

      const cond = where.length ? sql`where ${sql.join(where, sql` and `)}` : sql``;

      const rows = await sql`
        select a.*, c.codigo, c.nome
          from atendimentos a
          left join clientes c on c.id = a.cliente_id
        ${cond}
         order by a.created_at desc
         limit 500
      `;

      return res.json(
        rows.map((r) => ({
          id: r.id,
          cliente_id: r.cliente_id,
          titulo: r.titulo,
          modulo: r.modulo,
          motivo: r.motivo,
          data: r.data ? new Date(r.data).toISOString().slice(0, 10) : null,
          solicitante: r.solicitante,
          col: r.col,
          problem: r.problem,
          solution: r.solution,
          created_at: r.created_at,
          codigo: r.codigo,
          nome: r.nome
        }))
      );
    }

    // ---------- POST (UPSERT) ----------
    // body: { id, cliente_id, titulo, modulo, motivo, data, solicitante, col, problem, solution }
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b.id || !b.titulo) return bad(res, 'Informe ao menos id e titulo');

      await sql`
        insert into atendimentos
          (id, cliente_id, titulo, modulo, motivo, data, solicitante, col, problem, solution)
        values
          (${b.id}, ${b.cliente_id || null}, ${b.titulo}, ${b.modulo || null}, ${b.motivo || null},
           ${normDate(b.data)}, ${b.solicitante || null}, ${b.col || 'aberto'},
           ${b.problem || null}, ${b.solution || null})
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
      `;

      // retorna com dados do cliente (como o GET)
      const out = await sql`
        select a.*, c.codigo, c.nome
          from atendimentos a
          left join clientes c on c.id = a.cliente_id
         where a.id = ${b.id}
      `;
      return res.status(201).json(out[0]);
    }

    // ---------- PATCH (atualização parcial) ----------
    // body: { id, [campos...] } — usado para mover coluna (col) e editar campos
    if (req.method === 'PATCH') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b.id) return bad(res, 'Informe id');

      const sets = [];
      if ('cliente_id'  in b) sets.push(sql`cliente_id  = ${b.cliente_id || null}`);
      if ('titulo'      in b) sets.push(sql`titulo      = ${b.titulo}`);
      if ('modulo'      in b) sets.push(sql`modulo      = ${b.modulo || null}`);
      if ('motivo'      in b) sets.push(sql`motivo      = ${b.motivo || null}`);
      if ('data'        in b) sets.push(sql`data        = ${normDate(b.data)}`);
      if ('solicitante' in b) sets.push(sql`solicitante = ${b.solicitante || null}`);
      if ('col'         in b) sets.push(sql`col         = ${b.col}`);
      if ('problem'     in b) sets.push(sql`problem     = ${b.problem || null}`);
      if ('solution'    in b) sets.push(sql`solution    = ${b.solution || null}`);

      if (!sets.length) return bad(res, 'Nada para atualizar');

      await sql`
        update atendimentos
           set ${sql.join(sets, sql`, `)}
         where id = ${b.id}
      `;

      const out = await sql`
        select a.*, c.codigo, c.nome
          from atendimentos a
          left join clientes c on c.id = a.cliente_id
         where a.id = ${b.id}
      `;
      return res.json(out[0]);
    }

    // ---------- DELETE ----------
    // /api/atendimentos?id=...
    if (req.method === 'DELETE') {
      const id = (req.query?.id || '').trim();
      if (!id) return bad(res, 'Informe id');
      await sql`delete from atendimentos where id = ${id}`;
      return res.json({ ok: true, id });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
    return bad(res, 'Método não suportado', 405);
  } catch (e) {
    console.error('[atendimentos]', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}
