# Skill Registry — app-finanzas

Generated: 2026-07-27. Project is greenfield (no project-level CLAUDE.md/skills yet — only prompt-app2-finanzas.md exists).

## Project Conventions
No project-level `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` found. Global user `CLAUDE.md` applies (conventional commits, no AI attribution, short answers, verify before asserting).

## Compact Rules (auto-resolved, inject into sub-agent prompts as relevant)

- **Commits**: conventional commits only, no "Co-Authored-By" / AI attribution.
- **Money**: never float — integers in centavos (PEN cents) for all business logic; `NUMERIC(12,2)` only at the Postgres column/reporting layer; rounding = banker's rounding (ROUND_HALF_EVEN).
- **Balances**: materialized `balance` field on `accounts`, mutated only via a Postgres RPC transaction alongside the `transactions` insert — never written directly from the client.
- **Multi-tenancy**: enforced via Postgres Row Level Security (`user_id = auth.uid()`) on every table, never via app-level filtering alone.
- **Timezones**: `occurred_at` stored as `timestamptz` (UTC); month-cutoff logic for reports/budgets computed in the user's stored `timezone` (default `America/Lima`), never in UTC.
- **Offline sync**: WatermelonDB local SQLite + `client_id` idempotency key per movement created offline; conflicts resolved last-write-wins by `updated_at`, balances never synced directly (always server-recomputed).

## User-Level Skill Triggers (relevant subset)

| Skill | Trigger |
|---|---|
| go-testing | Go tests, Bubbletea TUI testing (not applicable to this RN/TS project) |
| skill-creator | Creating new AI agent skills |
| branch-pr | Creating a pull request |
| issue-creation | Creating a GitHub issue |
| judgment-day | Adversarial dual-review on request |

No RN/TS/Expo/Supabase-specific project skill exists yet. Recommend running `skill-registry` again once the codebase is scaffolded so stack-specific conventions (ESLint rules, component structure) get captured.
