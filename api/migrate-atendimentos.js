// /api/migrate-atendimentos.js
import { sql } from './_db.js';

export default async function handler(req, res) {
  try {
    const token =
      req.query?.token ||
      req.headers['x-migrate-token'] ||
      req.headers['x-token'];

    if (!token || token !== process.env.MIGRATE_TOKEN) {
      return res.status(401).json({ error: 'não autorizado' });
    }

    // Tabela de clientes já deve existir (usada no left join)
    // Tabela de atendimentos
    await sql`
      create table if not exists atendimentos (
        id          text primary key,
        cliente_id  text references clientes(id) on delete set null,
        titulo      text not null,
        modulo      text,
        motivo      text,
        data        date,
        solicitante text,
        col         text not null default 'aberto',
        problem     text,
        solution    text,
        created_at  timestamptz not null default now()
      );
    `;

    // Índices úteis
    await sql`create index if not exists idx_atend_col on atendimentos(col);`;
    await sql`create index if not exists idx_atend_cliente on atendimentos(cliente_id);`;
    await sql`create index if not exists idx_atend_created on atendimentos(created_at desc);`;

    res.json({ ok: true, created: 'atendimentos' });
  } catch (e) {
    console.error('[migrate-atendimentos] ', e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}
