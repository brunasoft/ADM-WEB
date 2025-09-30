// api/migrate.js
import { sql } from './_db.js';

export default async function handler(req, res) {
  const token = req.query.token || req.headers['x-migrate-token'];
  if (!token || token !== process.env.MIGRATE_TOKEN) {
    return res.status(401).json({ error: 'não autorizado' });
  }

  try {
    // 1) tabela
    await sql`
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
    `;

    // 2) índices
    await sql`create index if not exists idx_clientes_nome on clientes (lower(nome));`;
    await sql`create index if not exists idx_clientes_codigo on clientes (codigo);`;

    return res.json({ ok: true, ran: 3 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
