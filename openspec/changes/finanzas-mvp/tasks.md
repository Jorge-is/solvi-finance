# Tasks: Finanzas MVP — Fase 1

## Phase 1: Foundation

- [x] 1.1 Init Supabase project; scaffold `supabase/migrations/0001_init.sql` with tables `profiles`, `accounts`, `categories`, `transactions`, `budgets` (amounts as `BIGINT` centavos, `occurred_at timestamptz`, `client_id text` on `transactions`)
- [x] 1.2 Add RLS policies (`user_id = auth.uid()`) to every table in `0001_init.sql`
- [x] 1.3 Add unique constraint `(user_id, client_id)` on `transactions` for idempotent sync
- [x] 1.4 Write `supabase/migrations/0002_apply_transaction.sql` with `apply_transaction()` and `apply_transfer()` RPCs (`SECURITY DEFINER`, single transaction, mutate `accounts.balance`)
- [x] 1.5 Scaffold Expo (TS) app in `mobile/`; add WatermelonDB with local schema mirroring `accounts`/`transactions`/`categories`/`budgets`
- [x] 1.6 Configure Supabase Auth client in `mobile/src/lib/supabase.ts`; store session via `expo-secure-store`

## Phase 2: Core Implementation

- [ ] 2.1 Implement login/magic-link screens (`mobile/src/screens/Auth/`) calling Supabase Auth
- [ ] 2.2 Implement biometric unlock (`expo-local-authentication`) gating app entry when a stored session exists
- [ ] 2.3 Implement account CRUD screens and WatermelonDB model (`mobile/src/models/Account.ts`)
- [ ] 2.4 Implement quick-entry transaction form (amount, type, account, category, payment method, note) writing to local WatermelonDB, ≤3 taps to submit
- [ ] 2.5 Implement transfer flow calling `apply_transfer()` semantics (local queued as linked debit/credit)
- [ ] 2.6 Implement `supabase/functions/sync/` Edge Function following WatermelonDB sync protocol, calling `apply_transaction`/`apply_transfer` per queued row
- [ ] 2.7 Wire WatermelonDB sync adapter (`mobile/src/sync/`) to call the sync endpoint on reconnect; surface pending/failed state in UI
- [ ] 2.8 Implement budget CRUD screens and category-scoped monthly limit storage
- [ ] 2.9 Implement `supabase/functions/evaluate-budgets/` scheduled function computing spent-vs-limit per user/category/month and sending Expo push at 80% and 100% thresholds (once each per budget/month)
- [ ] 2.10 Implement monthly cash-flow and category-breakdown report queries (local-timezone month boundaries, transfers excluded)
- [ ] 2.11 Implement CSV export (movements → CSV with soles-formatted amounts) and CSV import (validate rows, atomic insert, per-row error reporting)

## Phase 3: Integration / Wiring

- [ ] 3.1 Wire navigation: Auth → biometric gate → Home (accounts + total balance) → Quick Entry / Reports / Budgets / Settings
- [ ] 3.2 Wire push notification permissions request and Expo push token registration on login

## Phase 4: Testing

- [ ] 4.1 Unit tests: centavos arithmetic + banker's rounding (spec: Monetary Precision)
- [ ] 4.2 Integration tests (pgTAP or SQL scripts): `apply_transaction` and `apply_transfer` atomicity, incl. concurrent calls (spec: Materialized Balance, Transfers)
- [ ] 4.3 Integration tests: RLS isolation — user A cannot read/write user B's rows (spec: Multi-Tenant Data Isolation)
- [ ] 4.4 E2E test: offline entry → reconnect → sync exactly once per `client_id` (spec: Sync Without Duplication)
- [ ] 4.5 Unit tests: local-timezone month boundary attribution for reports and budgets (spec: Timezone-Correct Timestamps)
- [ ] 4.6 Integration tests: budget alert fires once at 80% and once at 100%, no duplicates (spec: Budget Evaluation)
- [ ] 4.7 Unit tests: CSV import validation — valid rows import, invalid row reported without corrupting balances (spec: CSV Import)

## Phase 5: Cleanup

- [ ] 5.1 Generate `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`, and `docs/decisions/*.md` ADRs from the approved proposal/design
- [ ] 5.2 Add `README.md` with setup instructions (Supabase project, `.env`, running `mobile/` via Expo)
