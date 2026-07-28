import { appSchema, tableSchema } from "@nozbe/watermelondb";

// Local WatermelonDB (SQLite) schema mirroring the Postgres tables in
// supabase/migrations/0001_init.sql.
//
// Money: all `*_centavos` columns mirror Postgres BIGINT centavos as WatermelonDB
// `number` columns (stored as JS numbers / SQLite INTEGER). This is safe: JS numbers
// are exact integers up to 2^53-1 (~90 trillion centavos = ~S/ 900 billion), far beyond
// any realistic personal-finance amount. Never store money as float/decimal here.
//
// `profiles` has no local mirror — it's a single row per user managed by Supabase Auth
// and read directly from the server, not synced offline.
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "accounts",
      columns: [
        // Postgres accounts.id once this row has been synced to the server.
        { name: "server_id", type: "string", isIndexed: true, isOptional: true },
        { name: "name", type: "string" },
        { name: "type", type: "string" }, // 'efectivo' | 'banco' | 'yape' | 'plin'
        // Mirrors accounts.balance. Locally this is a read cache — the source of
        // truth is always the server, mutated only via apply_transaction/apply_transfer.
        { name: "balance_centavos", type: "number" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "categories",
      columns: [
        { name: "server_id", type: "string", isIndexed: true, isOptional: true },
        { name: "name", type: "string" },
        { name: "kind", type: "string" }, // 'income' | 'expense'
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "transactions",
      columns: [
        { name: "server_id", type: "string", isIndexed: true, isOptional: true },
        { name: "account_id", type: "string", isIndexed: true },
        { name: "category_id", type: "string", isIndexed: true, isOptional: true },
        { name: "type", type: "string" }, // 'income' | 'expense' | 'transfer'
        { name: "amount_centavos", type: "number" }, // always positive; sign comes from `type`
        { name: "payment_method", type: "string", isOptional: true },
        { name: "note", type: "string", isOptional: true },
        { name: "occurred_at", type: "number" }, // epoch ms, UTC instant
        { name: "transfer_id", type: "string", isIndexed: true, isOptional: true },
        { name: "reverses_transaction_id", type: "string", isOptional: true },
        // Client-generated idempotency key — required for offline sync (spec: Sync
        // Without Duplication). Matches the unique (user_id, client_id) constraint
        // on the server `transactions` table.
        { name: "client_id", type: "string", isIndexed: true },
        { name: "sync_status", type: "string" }, // 'pending' | 'synced' | 'failed'
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "budgets",
      columns: [
        { name: "server_id", type: "string", isIndexed: true, isOptional: true },
        { name: "category_id", type: "string", isIndexed: true },
        { name: "month", type: "number" }, // epoch ms, first day of month in user's local tz
        { name: "limit_centavos", type: "number" },
        { name: "alert_80_sent", type: "boolean" },
        { name: "alert_100_sent", type: "boolean" },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    }),
  ],
});
