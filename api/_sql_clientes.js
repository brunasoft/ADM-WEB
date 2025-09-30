export const SQL_CLIENTES = `
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

