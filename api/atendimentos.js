// api/atendimentos.js
// API REST para a tela de Atendimentos (Kanban) — versão blindada contra "$1 entre aspas"

import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

// aceita vários nomes de variável no Vercel/Neon
const DB_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.ARMAZENAR_URL; // se usou prefixo custom

if (!DB_URL) throw new Error('Defina POSTGRES_URL/DATABASE_URL nas variáveis do projeto (Vercel).');

const sql = neon(DB_URL);

const STATUS = ['aberto', 'atendimento', 'aguardando', 'programacao', 'concluido'];
const normDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// cria a tabela se não existir (idempotente e simples)
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
}

function bad(res, msg, code = 400) {
  return res.status(code).json({ ok: false, error: msg });
}

export default async function handler(req, res) {
  // CORS básico
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await ensureSchema();

    // ======= GET /api/atendimentos?q=texto&status=aberto =======
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const q = (url.searchParams.get('q') || '').trim();
      const status = (url.searchParams.get('status') || '').trim();

      let rows;

      if (q && status && STATUS.includes(status)) {
        // Busca + filtro de status (sem usar "${like}")
        rows = await sql`
          SELECT id, cliente_id, titulo, modulo, motivo, data, solicitante,
                 col, problem, solution, created_at
            FROM atendimentos
           WHERE (
                  titulo      ILIKE '%' || ${q} || '%'
               OR motivo      ILIKE '%' || ${q} || '%'
               OR solicitante ILIKE '%' || ${q} || '%'
                 )
             AND col = ${status}
           ORDER BY created_at DESC
           LIMIT 200
        `;
      } else if (q) {
        rows = await sql`
          SELECT id, cliente_id, titulo, modulo, motivo, data, solicitante,
                 col, problem, solution, created_at
            FROM atendimentos
           WHERE  titulo      ILIKE '%' || ${q} || '%'
               OR motivo      ILIKE '%' || ${q} || '%'
               OR solicitante ILIKE '%' || ${q} || '%'
           ORDER BY created_at DESC
           LIMIT 200
        `;
      } else if (status && STATUS.includes(status)) {
        rows = await sql`
          SELECT id, cliente_id, titulo, modulo, motivo, data, solicitante,
                 col, problem, solution, created_at
            FROM atendimentos
           WHERE col = ${status}
           ORDER BY created_at DESC
           LIMIT 200
        `;
      } else {
        rows = await sql`
          SELECT id, cliente_id, titulo, modulo, motivo, data, solicitante,
                 col, problem, solution, created_at
            FROM atendimentos
           ORDER BY created_at DESC
           LIMIT 200
        `;
      }

      return res.status(200).json(rows);
    }

    // Parse do body (Vercel às vezes entrega string)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // ======= POST (UPSERT) /api/atendimentos =======
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
      } = body;

      if (!id || !titulo) return bad(res, 'Campos obrigatórios: id e titulo');
      if (!STATUS.includes(col)) return bad(res, 'Status inválido');

      const rows = await sql`
        INSERT INTO atendimentos
          (id, cliente_id, titulo, modulo, motivo, data, solicitante, col, problem, solution)
        VALUES
          (${id}, ${cliente_id}, ${titulo}, ${modulo}, ${motivo}, ${normDate(data)},
           ${solicitante}, ${col}, ${problem}, ${solution})
        ON CONFLICT (id) DO UPDATE SET
          cliente_id  = EXCLUDED.cliente_id,
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

    // ======= PATCH (atualiza campo a campo; sem SQL dinâmico) =======
    if (req.method === 'PATCH') {
      const { id } = body;
      if (!id) return bad(res, 'Informe o id');

      if ('cliente_id'  in body) await sql`UPDATE atendimentos SET cliente_id  = ${body.cliente_id || null} WHERE id = ${id}`;
      if ('titulo'      in body) await sql`UPDATE atendimentos SET titulo      = ${body.titulo}            WHERE id = ${id}`;
      if ('modulo'      in body) await sql`UPDATE atendimentos SET modulo      = ${body.modulo || null}    WHERE id = ${id}`;
      if ('motivo'      in body) await sql`UPDATE atendimentos SET motivo      = ${body.motivo || null}    WHERE id = ${id}`;
      if ('data'        in body) await sql`UPDATE atendimentos SET data        = ${normDate(body.data)}     WHERE id = ${id}`;
      if ('solicitante' in body) await sql`UPDATE atendimentos SET solicitante = ${body.solicitante || null}WHERE id = ${id}`;
      if ('problem'     in body) await sql`UPDATE atendimentos SET problem     = ${body.problem || null}   WHERE id = ${id}`;
      if ('solution'    in body) await sql`UPDATE atendimentos SET solution    = ${body.solution || null}  WHERE id = ${id}`;
      if ('col'         in body) {
        if (!STATUS.includes(body.col)) return bad(res, 'Status inválido');
        await sql`UPDATE atendimentos SET col = ${body.col} WHERE id = ${id}`;
      }

      const r = await sql`SELECT * FROM atendimentos WHERE id = ${id}`;
      if (!r.length) return bad(res, 'Registro não encontrado', 404);
      return res.status(200).json(r[0]);
    }

    // ======= DELETE /api/atendimentos?id=... =======
    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) return bad(res, 'Informe o id');

      const r = await sql`DELETE FROM atendimentos WHERE id = ${id} RETURNING *`;
      if (!r.length) return bad(res, 'Registro não encontrado', 404);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
    return bad(res, 'Método não suportado', 405);
  } catch (err) {
    console.error('[api/atendimentos] ERRO:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
}
