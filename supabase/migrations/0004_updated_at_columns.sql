-- 0004_updated_at_columns.sql
-- Phase 2 (task 2.6/2.7): the WatermelonDB sync protocol needs to detect which server-side
-- rows changed since the client's last pull. `transactions` is insert-only (corrections are
-- modeled as reversal + new row — spec: Account Correction Without Data Loss) so `created_at`
-- alone is a sufficient change marker there. But `accounts` (rename/change type),
-- `categories`, and `budgets` (limit edits, alert_80_sent/alert_100_sent flips from
-- evaluate-budgets) ARE mutated in place and 0001_init.sql did not give them an `updated_at`
-- column — without one, pullChanges cannot tell "updated" rows from "unchanged" ones on
-- incremental syncs. This migration adds it plus a trigger to keep it current automatically.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table accounts add column updated_at timestamptz not null default now();
alter table categories add column updated_at timestamptz not null default now();
alter table budgets add column updated_at timestamptz not null default now();

create trigger accounts_set_updated_at before update on accounts
  for each row execute function set_updated_at();
create trigger categories_set_updated_at before update on categories
  for each row execute function set_updated_at();
create trigger budgets_set_updated_at before update on budgets
  for each row execute function set_updated_at();
