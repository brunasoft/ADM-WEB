// /api/diag.js
export const config = { runtime: 'edge' };
import { sql } from './_db.js';

export default async function handler(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token || token !== process.env.MIGRATE_TOKEN) {
    return new Response(JSON.stringify({ error: 'não autorizado' }), { status: 401 });
  }

  try {
    const r = await sql`select 'ok'::text as status`;
    return new Response(JSON.stringify({
      envs: {
        has_DATABASE_URL: !!process.env.DATABASE_URL,
        has_POSTGRES_URL: !!process.env.POSTGRES_URL,
        has_NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL
      },
      db: r?.[0]?.status || 'fail'
    }), { headers: { 'content-type': 'application/json' }});
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
