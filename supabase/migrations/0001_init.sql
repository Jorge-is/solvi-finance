-- 0001_init.sql
-- Phase 1: Foundation schema for Finanzas MVP.
-- Tables: profiles, accounts, categories, transactions, budgets.
-- Money is ALWAYS bigint centavos (PEN). Never float/real.
-- accounts.balance is materialized and MUST only be mutated by the
-- apply_transaction()/apply_transfer() RPCs defined in 0002_apply_transaction.sql.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'America/Lima',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('efectivo', 'banco', 'yape', 'plin')),
  balance bigint not null default 0, -- centavos PEN, mutated only via RPC
  created_at timestamptz not null default now()
);
create index idx_accounts_user on accounts(user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default now()
);
create index idx_categories_user on categories(user_id);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  account_id uuid not null references accounts(id),
  category_id uuid references categories(id),
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_centavos bigint not null check (amount_centavos > 0), -- always positive; sign comes from `type`
  payment_method text,
  note text,
  occurred_at timestamptz not null default now(),
  transfer_id uuid, -- groups the debit+credit rows of a transfer
  reverses_transaction_id uuid references transactions(id), -- corrections: reversal + new row, never UPDATE
  client_id text not null, -- offline sync idempotency key
  created_at timestamptz not null default now(),
  unique (user_id, client_id) -- 1.3: idempotent sync
);
create index idx_transactions_user_date on transactions(user_id, occurred_at desc);
create index idx_transactions_account on transactions(account_id);
create index idx_transactions_category on transactions(category_id);
create index idx_transactions_transfer on transactions(transfer_id) where transfer_id is not null;

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------

create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  category_id uuid not null references categories(id),
  month date not null, -- first day of month, in the user's local time
  limit_centavos bigint not null check (limit_centavos > 0),
  alert_80_sent boolean not null default false,
  alert_100_sent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);
create index idx_budgets_user_month on budgets(user_id, month);

-- ---------------------------------------------------------------------------
-- Row Level Security (1.2) — every table, user_id = auth.uid()
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;

-- profiles: a user may only see/manage their own profile row (id == auth.uid())
create policy "own profile only" on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own rows only" on accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own rows only" on categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own rows only" on transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own rows only" on budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Column-level privileges: prevent direct client writes to accounts.balance.
-- RLS is row-level only, so we additionally restrict which columns the
-- `authenticated` role may UPDATE directly. `balance` is deliberately
-- excluded — it may only change through the SECURITY DEFINER RPCs in
-- 0002_apply_transaction.sql, which run as the table owner and therefore
-- bypass this column grant.
-- ---------------------------------------------------------------------------

grant select, insert, delete on accounts to authenticated;
grant update (name, type) on accounts to authenticated;

grant select, insert, update, delete on profiles to authenticated;
grant select, insert, update, delete on categories to authenticated;
grant select, insert, delete on transactions to authenticated; -- no update: corrections are insert-only (reversal + new row)
grant select, insert, update, delete on budgets to authenticated;
