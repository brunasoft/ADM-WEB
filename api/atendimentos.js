// api/atendimentos.js
// API REST para a tela de Atendimentos (Kanban)

import { sql } from './_db.js';

const STATUS = ['aberto', 'atendimento', 'aguardando', 'programacao', 'concluido'];

// Garante que a tabela exista (idempotente)
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS atendimentos (
      id          TEXT PRIMARY KEY,
      cliente_id  TEXT,
      titulo      TEXT NOT NULL,
      modulo      TEXT,
      motivo      TEXT,
      data        DATE,
      solicitante TEXT,
      col         TEXT NOT NULL DEFAULT 'aberto',
      problem     TEXT,
      solution    TEXT,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_at_col   ON atendimentos (col)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_at_data  ON atendimentos (data)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_at_tit   ON atendimentos (lower(titulo))`;
}

function bad(res, msg = 'Requisição inválida', code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}

export default async function handler(req, res) {
  try {
    await ensureSchema();

    // ====== GET /api/atendimentos[?q=texto&status=aberto]
    if (req.method === 'GET') {
      // Em ambiente Vercel/Node, req.url é relativo — normalizamos para ler searchParams
      const url = new URL(req.url, `http://${req.headers.host}`);
      const q = (url.searchParams.get('q') || '').trim();
      const status = (url.searchParams.get('status') || '').trim();

      const where = [];
      if (q) {
        // busca em título/motivo/solicitante
        const like = `%${q}%`;
        where.push(sql`(titulo ILIKE ${like} OR motivo ILIKE ${like} OR solicitante ILIKE ${like})`);
      }
      if (status && STATUS.includes(status)) {
        where.push(sql`col = ${status}`);
      }

      const rows = await sql`
        SELECT id, cliente_id, titulo, modulo, motivo, data, solicitante,
               col, problem, solution, created_at
        FROM atendimentos
        ${where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``}
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return res.status(200).json(rows);
    }

    // ====== POST /api/atendimentos  (upsert)
    // Body JSON:
    // { id, cliente_id, titulo, modulo, motivo, data, solicitante, col, problem, solution }
    if (req.method === 'POST') {
      const {
        id,
        cliente_id = null,
        titulo,
        modulo = null,
        motivo = null,
        data = null,
        solicitante = null,
        col = 'aberto',
        problem = null,
        solution = null
      } = req.body || {};

      if (!id || !titulo) return bad(res, 'Campos obrigatórios: id e titulo');
      if (!STATUS.includes(col)) return bad(res, 'Status inválido');

      const rows = await sql`
        INSERT INTO atendimentos (id, cliente_id, titulo, modulo, motivo, data,
                                  solicitante, col, problem, solution)
        VALUES (${id}, ${cliente_id}, ${titulo}, ${modulo}, ${motivo}, ${data},
                ${solicitante}, ${col}, ${problem}, ${solution})
        ON CONFLICT (id) DO UPDATE
          SET cliente_id  = EXCLUDED.cliente_id,
              titulo      = EXCLUDED.titulo,
              modulo      = EXCLUDED.modulo,
              motivo      = EXCLUDED.motivo,
              data        = EXCLUDED.data,
              solicitante = EXCLUDED.solicitante,
              col         = EXCLUDED.col,
              problem     = EXCLUDED.problem,
              solution    = EXCLUDED.solution
        RETURNING *
      `;
      return res.status(200).json(rows[0]);
    }

    // ====== PATCH /api/atendimentos  (atualiza campos soltos por id)
    // Body JSON: { id, ...campos }
    if (req.method === 'PATCH') {
      const {
        id,
        titulo,
        modulo,
        motivo,
        data,
        solicitante,
        col,
        problem,
        solution
      } = req.body || {};

      if (!id) return bad(res, 'Informe o id');

      const sets = [];
      if (titulo !== undefined)      sets.push(sql`titulo = ${titulo}`);
      if (modulo !== undefined)      sets.push(sql`modulo = ${modulo}`);
      if (motivo !== undefined)      sets.push(sql`motivo = ${motivo}`);
      if (data !== undefined)        sets.push(sql`data = ${data}`);
      if (solicitante !== undefined) sets.push(sql`solicitante = ${solicitante}`);
      if (problem !== undefined)     sets.push(sql`problem = ${problem}`);
      if (solution !== undefined)    sets.push(sql`solution = ${solution}`);
      if (col !== undefined) {
        if (!STATUS.includes(col)) return bad(res, 'Status inválido');
        sets.push(sql`col = ${col}`);
      }
      if (!sets.length) return bad(res, 'Nada para atualizar');

      const rows = await sql`
        UPDATE atendimentos
           SET ${sql.join(sets, sql`, `)}
         WHERE id = ${id}
        RETURNING *
      `;
      if (!rows.length) return bad(res, 'Registro não encontrado', 404);
      return res.status(200).json(rows[0]);
    }

    // ====== DELETE /api/atendimentos?id=...
    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) return bad(res, 'Informe o id');

      const rows = await sql`DELETE FROM atendimentos WHERE id = ${id} RETURNING *`;
      if (!rows.length) return bad(res, 'Registro não encontrado', 404);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE');
    return bad(res, 'Método não suportado', 405);
  } catch (err) {
    console.error('[api/atendimentos] ERRO:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
}
