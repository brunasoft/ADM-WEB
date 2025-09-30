// /api/_db.js
import { neon, neonConfig } from '@neondatabase/serverless';

// cache de conexões no ambiente serverless da Vercel
neonConfig.fetchConnectionCache = true;

// aceita vários nomes de variável para funcionar com Vercel+Neon
const URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!URL) {
  throw new Error('Defina POSTGRES_URL (ou DATABASE_URL) nas Variáveis de Ambiente');
}

export const sql = neon(URL);
