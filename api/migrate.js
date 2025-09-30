// /api/migrate.js
export const config = { runtime: 'edge' };
import { sql, json } from './_db.js';

const SQL = `
create table if not exists clientes (
  id         text primary key,
  codigo     text not null unique,
  nome       text not null,
  status     text not null default 'ativo' check (status in ('ativo','inativo')),
  contato    text,
  telefone   text,
  email      text,
  endereco   text,
  created_at timestamptz not null default now()
);
create index if not exists idx_clientes_nome on clientes (lower(nome));
create index if not exists idx_clientes_codigo on clientes (codigo);
`;

export default async function handler(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || req.headers.get('x-migrate-token');
  if (!token || token !== process.env.MIGRATE_TOKEN) return json({ error: 'não autorizado' }, 401);

  try {
    await sql.unsafe(SQL);
    return json({ ok: true, ran: 1 });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
