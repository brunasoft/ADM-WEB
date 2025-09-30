import { neon, neonConfig } from '@neondatabase/serverless';
neonConfig.fetchConnectionCache = true;

const URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.ARMAZENAR_URL; // caso tenha usado esse prefixo na integração

if (!URL) throw new Error('Set POSTGRES_URL / DATABASE_URL in Vercel.');

export const sql = neon(URL);
