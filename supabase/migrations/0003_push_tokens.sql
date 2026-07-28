-- 0003_push_tokens.sql
-- Phase 2 (task 2.9): storage for Expo push tokens, read by the evaluate-budgets
-- scheduled Edge Function to deliver 80%/100% budget alerts.
--
-- Population of this table (requesting notification permission + registering the
-- Expo push token on login) is Phase 3 task 3.2 — out of scope here. This migration
-- only adds the schema so the Phase 2 evaluate-budgets function has somewhere to read
-- from once Phase 3 wires up registration.

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  expo_push_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);
create index idx_push_tokens_user on push_tokens(user_id);

alter table push_tokens enable row level security;

-- A user may register/remove their own device tokens directly; evaluate-budgets
-- reads across all users using the service_role key, which bypasses RLS.
create policy "own rows only" on push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on push_tokens to authenticated;
