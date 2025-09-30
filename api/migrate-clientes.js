// api/migrate-clientes.js
import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

const DB_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.ARMAZENAR_URL;

export default async function handler(req, res) {
  try {
    const token = req.query.token || req.headers['x-migrate-token'];
    if (!token || token !== process.env.MIGRATE_TOKEN) {
      return res.status(401).json({ ok: false, error: 'não autorizado' });
    }

    const sql = neon(DB_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS clientes (
        id         TEXT PRIMARY KEY,
        codigo     TEXT NOT NULL UNIQUE,
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

    res.json({ ok: true, created: 'clientes' });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
