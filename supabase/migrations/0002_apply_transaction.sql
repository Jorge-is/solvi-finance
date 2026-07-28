-- 0002_apply_transaction.sql
-- RPC functions that are the ONLY writers of accounts.balance.
-- Both are SECURITY DEFINER (run as table owner, bypassing the column-level
-- UPDATE grant restriction on accounts.balance from 0001_init.sql) and both
-- run as a single Postgres transaction, so the transaction insert and the
-- balance update either both happen or neither does.
--
-- Idempotency: retried calls with the same client_id must not double-apply
-- (spec: "Sync Without Duplication"). Both functions check for an existing
-- row by (user_id, client_id) first and short-circuit by returning it,
-- and additionally guard against a concurrent-retry race via the unique
-- constraint + an exception handler that falls back to a re-select.

-- ---------------------------------------------------------------------------
-- apply_transaction: income/expense against a single account
-- ---------------------------------------------------------------------------

create or replace function apply_transaction(
  p_account_id uuid,
  p_type text,
  p_amount_centavos bigint,
  p_category_id uuid,
  p_payment_method text,
  p_note text,
  p_occurred_at timestamptz,
  p_client_id text
) returns transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx transactions;
  v_delta bigint;
  v_owns_account boolean;
begin
  if p_type not in ('income', 'expense') then
    raise exception 'apply_transaction only supports income/expense; use apply_transfer for transfers';
  end if;

  if p_amount_centavos <= 0 then
    raise exception 'amount_centavos must be positive';
  end if;

  select exists(
    select 1 from accounts where id = p_account_id and user_id = auth.uid()
  ) into v_owns_account;

  if not v_owns_account then
    raise exception 'account % is not owned by the current user', p_account_id;
  end if;

  -- Idempotency short-circuit: same client_id already applied.
  select * into v_tx from transactions
  where user_id = auth.uid() and client_id = p_client_id;

  if found then
    return v_tx;
  end if;

  v_delta := case when p_type = 'expense' then -p_amount_centavos else p_amount_centavos end;

  begin
    insert into transactions (
      user_id, account_id, category_id, type, amount_centavos,
      payment_method, note, occurred_at, client_id
    ) values (
      auth.uid(), p_account_id, p_category_id, p_type, p_amount_centavos,
      p_payment_method, p_note, coalesce(p_occurred_at, now()), p_client_id
    )
    returning * into v_tx;
  exception when unique_violation then
    -- Concurrent retry raced us: the row now exists, return it (no double apply).
    select * into v_tx from transactions
    where user_id = auth.uid() and client_id = p_client_id;
    return v_tx;
  end;

  update accounts set balance = balance + v_delta
  where id = p_account_id and user_id = auth.uid();

  return v_tx;
end;
$$;

revoke all on function apply_transaction(uuid, text, bigint, uuid, text, text, timestamptz, text) from public;
grant execute on function apply_transaction(uuid, text, bigint, uuid, text, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- apply_transfer: atomic transfer between two of the user's own accounts.
-- Inserts two linked `transactions` rows (type = 'transfer') sharing a
-- transfer_id: a debit row on the source account and a credit row on the
-- destination account. Debits the source balance and credits the
-- destination balance in the same transaction.
-- ---------------------------------------------------------------------------

create or replace function apply_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount_centavos bigint,
  p_occurred_at timestamptz,
  p_client_id text,
  p_note text default null
) returns table(debit transactions, credit transactions)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transfer_id uuid := gen_random_uuid();
  v_debit_client_id text := p_client_id || ':debit';
  v_credit_client_id text := p_client_id || ':credit';
  v_debit transactions;
  v_credit transactions;
  v_from_owner uuid;
  v_to_owner uuid;
begin
  if p_amount_centavos <= 0 then
    raise exception 'amount_centavos must be positive';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'cannot transfer an account to itself';
  end if;

  select user_id into v_from_owner from accounts where id = p_from_account_id;
  select user_id into v_to_owner from accounts where id = p_to_account_id;

  if v_from_owner is null or v_to_owner is null then
    raise exception 'source or destination account not found';
  end if;

  -- Both accounts MUST belong to the caller (spec: Transfers Between Accounts).
  if v_from_owner <> auth.uid() or v_to_owner <> auth.uid() then
    raise exception 'both accounts must belong to the current user';
  end if;

  -- Idempotency short-circuit: same client_id pair already applied.
  select * into v_debit from transactions
  where user_id = auth.uid() and client_id = v_debit_client_id;
  select * into v_credit from transactions
  where user_id = auth.uid() and client_id = v_credit_client_id;

  if v_debit.id is not null and v_credit.id is not null then
    debit := v_debit;
    credit := v_credit;
    return next;
    return;
  end if;

  begin
    insert into transactions (
      user_id, account_id, category_id, type, amount_centavos,
      note, occurred_at, transfer_id, client_id
    ) values (
      auth.uid(), p_from_account_id, null, 'transfer', p_amount_centavos,
      p_note, coalesce(p_occurred_at, now()), v_transfer_id, v_debit_client_id
    )
    returning * into v_debit;

    insert into transactions (
      user_id, account_id, category_id, type, amount_centavos,
      note, occurred_at, transfer_id, client_id
    ) values (
      auth.uid(), p_to_account_id, null, 'transfer', p_amount_centavos,
      p_note, coalesce(p_occurred_at, now()), v_transfer_id, v_credit_client_id
    )
    returning * into v_credit;
  exception when unique_violation then
    -- Concurrent retry raced us: re-fetch both rows already inserted, apply nothing again.
    select * into v_debit from transactions
    where user_id = auth.uid() and client_id = v_debit_client_id;
    select * into v_credit from transactions
    where user_id = auth.uid() and client_id = v_credit_client_id;
    debit := v_debit;
    credit := v_credit;
    return next;
    return;
  end;

  update accounts set balance = balance - p_amount_centavos
  where id = p_from_account_id and user_id = auth.uid();

  update accounts set balance = balance + p_amount_centavos
  where id = p_to_account_id and user_id = auth.uid();

  debit := v_debit;
  credit := v_credit;
  return next;
end;
$$;

revoke all on function apply_transfer(uuid, uuid, bigint, timestamptz, text, text) from public;
grant execute on function apply_transfer(uuid, uuid, bigint, timestamptz, text, text) to authenticated;
