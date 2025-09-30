import { sql } from './_db.js';

export default async function handler(req, res) {
  const token = req.query.token || req.headers['x-migrate-token'];
  if (!token || token !== process.env.MIGRATE_TOKEN) {
    return res.status(401).json({ error: 'não autorizado' });
  }
  try {
    const r = await sql`select 'ok'::text as status`;
    res.json({
      envs: {
        has_DATABASE_URL: !!process.env.DATABASE_URL,
        has_POSTGRES_URL: !!process.env.POSTGRES_URL,
        has_NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL
      },
      db: r?.[0]?.status || 'fail'
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
