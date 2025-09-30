// /api/_db.js
import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

const URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!URL) {
  throw new Error('URL do banco não encontrada: defina DATABASE_URL ou POSTGRES_URL no Vercel.');
}

export const sql = neon(URL);

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
