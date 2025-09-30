import { sql } from './_db.js';

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

export default async function handler(req, res) {
  const token = req.query.token || req.headers['x-migrate-token'];
  if (!token || token !== process.env.MIGRATE_TOKEN) {
    return res.status(401).json({ error: 'não autorizado' });
  }
  try {
    await sql.unsafe(SQL);
    res.json({ ok: true, ran: 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
