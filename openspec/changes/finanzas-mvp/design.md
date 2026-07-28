# Design: Finanzas MVP — Fase 1

## Technical Approach

Greenfield project — no existing code to follow. Client: React Native (Expo, TypeScript) with WatermelonDB as local SQLite store and sync engine. Backend: Supabase (Postgres + Auth + Storage). All monetary math in integer centavos; balances materialized via a single Postgres RPC function (`apply_transaction`) that is the only writer of `accounts.balance`.

## Architecture Decisions

### Decision: Money representation
**Choice**: `BIGINT` centavos in Postgres and in the RN app's domain layer; format to "S/ X.XX" only in UI components.
**Alternatives considered**: `NUMERIC`/`DECIMAL` end-to-end; native JS `number` (float).
**Rationale**: Float causes cumulative rounding error in aggregates; `NUMERIC` in the app layer requires a bignum library everywhere. Integer centavos are exact, fast, and only need conversion at the UI boundary.

### Decision: Balance mutation path
**Choice**: Single Postgres function `apply_transaction(account_id, amount_centavos, ...)`, `SECURITY DEFINER`, called via RPC. Client never issues raw `UPDATE accounts SET balance = ...`.
**Alternatives considered**: Compute balance on read (SUM over transactions); trigger-based balance update on INSERT.
**Rationale**: Sum-on-read doesn't scale for reports once history is long, and doesn't work well offline. An `AFTER INSERT` trigger achieves atomicity too, but a callable RPC gives one clear entry point for both online and post-sync writes, plus transfer semantics (two rows, one call) that a per-row trigger can't express cleanly.

### Decision: Offline sync
**Choice**: WatermelonDB's sync protocol (`pullChanges`/`pushChanges`) against a Postgres-backed sync endpoint (Supabase Edge Function), with `client_id` as idempotency key on `transactions`.
**Alternatives considered**: Custom queue + manual REST retries.
**Rationale**: WatermelonDB's sync protocol already solves ordering, batching, and partial-failure retry; reimplementing it is unnecessary risk for a solo 3-4 week MVP.

### Decision: Multi-tenancy enforcement
**Choice**: Postgres RLS policy `USING (user_id = auth.uid())` on every table; Storage bucket policies mirror this per-user.
**Rationale**: DB-level enforcement means a client bug can't leak cross-tenant data — required given "seguridad como requisito de diseño."

## Data Flow

    RN App (WatermelonDB, local SQLite)
        │  create transaction (offline-capable)
        ▼
    Sync queue (client_id idempotency)
        │  on reconnect
        ▼
    Supabase Edge Function (sync endpoint)
        │  calls RPC
        ▼
    apply_transaction() [Postgres, SECURITY DEFINER, single tx]
        │  INSERT transactions row + UPDATE accounts.balance
        ▼
    RLS-protected tables (transactions, accounts, budgets, ...)

## File Changes

| File | Action | Description |
|------|--------|--------------|
| `mobile/` | Create | Expo app root (screens, WatermelonDB models, sync adapter) |
| `supabase/migrations/0001_init.sql` | Create | Tables: users profile, accounts, categories, transactions, budgets, RLS policies |
| `supabase/migrations/0002_apply_transaction.sql` | Create | `apply_transaction` and `apply_transfer` RPC functions |
| `supabase/functions/sync/` | Create | Edge Function implementing WatermelonDB sync protocol |
| `supabase/functions/evaluate-budgets/` | Create | Scheduled function: checks 80%/100% thresholds, sends push via Expo |

## Interfaces / Contracts

```sql
apply_transaction(
  p_account_id uuid, p_type text, p_amount_centavos bigint,
  p_category_id uuid, p_payment_method text, p_note text,
  p_occurred_at timestamptz, p_client_id text
) RETURNS transactions

apply_transfer(
  p_from_account_id uuid, p_to_account_id uuid,
  p_amount_centavos bigint, p_occurred_at timestamptz, p_client_id text
) RETURNS TABLE(debit transactions, credit transactions)
```

Both are single-transaction, idempotent on `(user_id, client_id)` via a unique constraint.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | Centavos arithmetic, banker's rounding, CSV parsing | Vitest/Jest on pure functions |
| Integration | `apply_transaction`/`apply_transfer` correctness incl. concurrent calls, RLS isolation | `pgTAP` or SQL test scripts against a local Supabase instance |
| E2E | Offline entry → reconnect → sync without duplication | Detox or manual scripted device test toggling airplane mode |

## Migration / Rollout

No existing data. Migrations applied in order via Supabase CLI; each capability (accounts, transactions, budgets, reports, csv) ships as its own migration file so a broken migration can be rolled back independently without affecting prior ones.

## Open Questions

- [ ] Push delivery: Expo Push Service directly vs. a third-party (OneSignal) — default to Expo Push Service (native to the stack, free) unless deliverability issues appear.
