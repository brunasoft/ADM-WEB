import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

// Aceita qualquer nome que a integração Vercel↔Neon cria
const URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!URL) throw new Error('Defina DATABASE_URL/POSTGRES_URL no Vercel.');

export const sql = neon(URL);
