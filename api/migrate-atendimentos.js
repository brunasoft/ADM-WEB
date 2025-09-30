// /api/migrate-atendimentos.js
import { neon } from '@neondatabase/serverless';

const SQL = `
CREATE TABLE IF NOT EXISTS atendimentos (
  id           text PRIMARY KEY,
  cliente_id   text REFERENCES clientes(id) ON DELETE SET NULL,
  titulo       text NOT NULL,
  modulo       text,
  motivo       text,
  data         date,
  solicitante  text,
  status       text NOT NULL DEFAULT 'aberto',
  problem      text,
  solution     text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status     ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_created_at ON atendimentos(created_at DESC);
`;

export default async function handler(req, res) {
  const token = req.query.token || req.headers['x-migrate-token'];
  if (!token || token !== process.env.MIGRATE_TOKEN) {
    return res.status(401).json({ error: 'não autorizado' });
  }
  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql(SQL);
    res.json({ ok: true, applied: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
