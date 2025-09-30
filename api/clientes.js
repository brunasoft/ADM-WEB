// api/clientes.js
import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

// aceita vários nomes de env no Vercel + Neon
const DB_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.ARMAZENAR_URL; // se você usou prefixo custom

if (!DB_URL) throw new Error('Defina POSTGRES_URL/DATABASE_URL nas variáveis do projeto (Vercel).');

const sql = neon(DB_URL);

// cria a tabela e índices se não existirem
async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS clientes (
      id         TEXT PRIMARY KEY,
      codigo     TEXT NOT NULL UNIQUE, -- único
      nome       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'ativo',
      contato    TEXT,
      telefone   TEXT,
      email      TEXT,
      endereco   TEXT,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_clientes_nome  ON clientes (lower(nome))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON clientes (codigo)`;
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

    // ---------- GET /api/clientes?q=texto ----------
    if (req.method === 'GET') {
      const q = (req.query.q || '').toString().trim();
      let rows;

      if (q) {
        // concatenação segura (evita "$1" entre aspas)
        rows = await sql`
          SELECT id,
                 codigo   AS code,
                 nome     AS name,
                 status,
                 contato  AS contact,
                 telefone AS phone,
                 email,
                 endereco AS address,
                 created_at
            FROM clientes
           WHERE  lower(codigo)  ILIKE '%' || ${q.toLowerCase()} || '%'
               OR lower(nome)    ILIKE '%' || ${q.toLowerCase()} || '%'
               OR lower(coalesce(contato,'')) ILIKE '%' || ${q.toLowerCase()} || '%'
           ORDER BY
               CASE
                 WHEN regexp_replace(codigo, '\D', '', 'g') ~ '^[0-9]+$'
                 THEN (regexp_replace(codigo, '\D', '', 'g'))::int
                 ELSE NULL
               END NULLS LAST,
               codigo ASC,
               created_at DESC
          LIMIT 500
        `;
      } else {
        rows = await sql`
          SELECT id,
                 codigo   AS code,
                 nome     AS name,
                 status,
                 contato  AS contact,
                 telefone AS phone,
                 email,
                 endereco AS address,
                 created_at
            FROM clientes
           ORDER BY
               CASE
                 WHEN regexp_replace(codigo, '\D', '', 'g') ~ '^[0-9]+$'
                 THEN (regexp_replace(codigo, '\D', '', 'g'))::int
                 ELSE NULL
               END NULLS LAST,
               codigo ASC,
               created_at DESC
          LIMIT 500
        `;
      }

      return res.status(200).json(rows);
    }

    // Parse do body (Vercel às vezes entrega string)
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    // ---------- POST /api/clientes  (upsert) ----------
    // body: { id?, code, name, status?, contact?, phone?, email?, address? }
    if (req.method === 'POST') {
      if (!body.code || !body.name) return bad(res, 'code e name são obrigatórios');

      const id = body.id || (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

      try {
        const row = (await sql`
          INSERT INTO clientes (id, codigo, nome, status, contato, telefone, email, endereco)
          VALUES (
            ${id},
            ${body.code},
            ${body.name},
            ${body.status ?? 'ativo'},
            ${body.contact ?? null},
            ${body.phone ?? null},
            ${body.email ?? null},
            ${body.address ?? null}
          )
          ON CONFLICT (id) DO UPDATE SET
            codigo   = EXCLUDED.codigo,
            nome     = EXCLUDED.nome,
            status   = EXCLUDED.status,
            contato  = EXCLUDED.contato,
            telefone = EXCLUDED.telefone,
            email    = EXCLUDED.email,
            endereco = EXCLUDED.endereco
          RETURNING
            id,
            codigo   AS code,
            nome     AS name,
            status,
            contato  AS contact,
            telefone AS phone,
            email,
            endereco AS address,
            created_at
        `)[0];

        return res.status(201).json(row);
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes('unique') && msg.includes('codigo')) {
          return bad(res, 'Já existe um cliente com este código.', 409);
        }
        return res.status(500).json({ ok: false, error: msg });
      }
    }

    // ---------- PATCH /api/clientes  ----------
    // body: { id, code?, name?, status?, contact?, phone?, email?, address? }
    if (req.method === 'PATCH') {
      if (!body.id) return bad(res, 'id é obrigatório');

      try {
        // atualizações campo a campo (sem SQL dinâmico)
        if ('code'    in body) await sql`UPDATE clientes SET codigo   = ${body.code}             WHERE id = ${body.id}`;
        if ('name'    in body) await sql`UPDATE clientes SET nome     = ${body.name}             WHERE id = ${body.id}`;
        if ('status'  in body) await sql`UPDATE clientes SET status   = ${body.status}           WHERE id = ${body.id}`;
        if ('contact' in body) await sql`UPDATE clientes SET contato  = ${body.contact ?? null}  WHERE id = ${body.id}`;
        if ('phone'   in body) await sql`UPDATE clientes SET telefone = ${body.phone ?? null}    WHERE id = ${body.id}`;
        if ('email'   in body) await sql`UPDATE clientes SET email    = ${body.email ?? null}    WHERE id = ${body.id}`;
        if ('address' in body) await sql`UPDATE clientes SET endereco = ${body.address ?? null}  WHERE id = ${body.id}`;

        // retornar o registro atualizado
        const out = await sql`
          SELECT id, codigo AS code, nome AS name, status,
                 contato AS contact, telefone AS phone, email, endereco AS address, created_at
            FROM clientes
           WHERE id = ${body.id}
        `;
        if (!out.length) return bad(res, 'Registro não encontrado', 404);
        return res.json(out[0]);
      } catch (e) {
        const msg = String(e?.message || e);
        if (msg.includes('unique') && msg.includes('codigo')) {
          return bad(res, 'Já existe um cliente com este código.', 409);
        }
        return res.status(500).json({ ok: false, error: msg });
      }
    }

    // ---------- DELETE /api/clientes?id=... ----------
    if (req.method === 'DELETE') {
      const id = (req.query.id || '').toString();
      if (!id) return bad(res, 'id é obrigatório');

      const r = await sql`DELETE FROM clientes WHERE id = ${id} RETURNING *`;
      if (!r.length) return bad(res, 'Registro não encontrado', 404);
      return res.json({ ok: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']);
    return bad(res, 'Método não suportado', 405);
  } catch (err) {
    console.error('[api/clientes] ERRO:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
}
