
export const config = { runtime: 'edge' }; // roda como Edge Function

import { sql, json } from './_db.js';
import { SQL_CLIENTES } from './_sql_clientes.js';

function authOK(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || req.headers.get('x-migrate-token');
  return token && process.env.MIGRATE_TOKEN && token === process.env.MIGRATE_TOKEN;
}

export default async function handler(req) {
  if (!authOK(req)) return json({ error: 'não autorizado' }, 401);

  try {
    await sql.unsafe(SQL_CLIENTES);
    return json({ ok: true, ran: 1 });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
