import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL ||
            process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING;

export default async function handler(req, res) {
  try {
    const sql = neon(URL);
    const r = await sql`select 'ok'::text as s`;
    res.json({ ok: true, result: r[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
