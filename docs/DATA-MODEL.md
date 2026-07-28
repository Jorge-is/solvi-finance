# Modelo de datos

## Principios

- **Dinero**: `BIGINT` en céntimos de PEN (nunca `float`). Toda la aritmética de negocio en enteros; formato "S/ X.XX" solo en la UI. Redondeo: banker's rounding (`ROUND_HALF_EVEN`) donde aplique (prorrateos).
- **Saldos**: campo materializado en `accounts.balance`, mutado exclusivamente por las funciones `apply_transaction`/`apply_transfer` (nunca por `UPDATE` directo del cliente).
- **Correcciones**: nunca se hace `UPDATE` destructivo sobre un movimiento pasado; una corrección es un movimiento de reversión + uno nuevo, preservando historial auditable.
- **Zonas horarias**: `occurred_at` en `timestamptz` (UTC). Cada usuario tiene `timezone` (default `America/Lima`); los cortes de mes para reportes/presupuestos se calculan en esa zona, no en UTC.

## Entidades y relaciones

```
profiles (1) ──< accounts (1) ──< transactions >── (1) categories
profiles (1) ──< categories
profiles (1) ──< budgets >── (1) categories
transactions (transfer_id agrupa 2 filas: débito + crédito)
```

## DDL

```sql
-- Perfil de usuario (extiende auth.users de Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Lima',
  created_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('efectivo', 'banco', 'yape', 'plin')),
  balance bigint not null default 0,  -- centavos PEN, mutado solo por RPC
  created_at timestamptz not null default now()
);
create index idx_accounts_user on accounts(user_id);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now()
);
create index idx_categories_user on categories(user_id);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  account_id uuid not null references accounts(id),
  category_id uuid references categories(id),
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_centavos bigint not null,       -- siempre positivo; el signo lo da `type`
  payment_method text,
  note text,
  occurred_at timestamptz not null default now(),
  transfer_id uuid,                       -- agrupa débito+crédito de una transferencia
  reverses_transaction_id uuid references transactions(id), -- para correcciones
  client_id text not null,                -- idempotencia de sync offline
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index idx_transactions_user_date on transactions(user_id, occurred_at desc);
create index idx_transactions_account on transactions(account_id);
create index idx_transactions_category on transactions(category_id);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id),
  month date not null,                    -- primer día del mes, en local time del usuario
  limit_centavos bigint not null,
  alert_80_sent boolean not null default false,
  alert_100_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);
create index idx_budgets_user_month on budgets(user_id, month);
```

## Row Level Security (todas las tablas)

```sql
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

create policy "own rows only" on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- misma política (repetida) en categories, transactions, budgets
```

## Funciones RPC (mutación de saldo)

```sql
create or replace function apply_transaction(
  p_account_id uuid, p_type text, p_amount_centavos bigint,
  p_category_id uuid, p_payment_method text, p_note text,
  p_occurred_at timestamptz, p_client_id text
) returns transactions
language plpgsql security definer as $$
declare
  v_tx transactions;
  v_delta bigint;
begin
  v_delta := case when p_type = 'expense' then -p_amount_centavos else p_amount_centavos end;

  insert into transactions (user_id, account_id, category_id, type, amount_centavos,
    payment_method, note, occurred_at, client_id)
  values (auth.uid(), p_account_id, p_category_id, p_type, p_amount_centavos,
    p_payment_method, p_note, p_occurred_at, p_client_id)
  returning * into v_tx;

  update accounts set balance = balance + v_delta
  where id = p_account_id and user_id = auth.uid();

  return v_tx;
end;
$$;

-- apply_transfer(from, to, amount, occurred_at, client_id):
-- inserta dos filas en transactions (type='transfer') con transfer_id compartido,
-- resta de la cuenta origen y suma a la cuenta destino, en la misma transacción.
```
