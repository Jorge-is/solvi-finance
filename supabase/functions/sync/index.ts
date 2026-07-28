// supabase/functions/sync/index.ts
//
// Implements the server side of WatermelonDB's sync protocol (pullChanges/pushChanges)
// for the Finanzas app. Deployed as a single Edge Function; routed by path suffix:
//   GET  /functions/v1/sync/pull?last_pulled_at=<ms>&schema_version=<n>
//   POST /functions/v1/sync/push   body: { changes, lastPulledAt }
//
// Design notes (see mobile/src/sync/index.ts for the matching client-side wrapper):
//
// - `accounts`, `categories`, `budgets` use a SHARED id convention: the client generates
//   a UUID locally (WatermelonDB's own record id) and this function persists rows in
//   Postgres using THAT SAME id as the primary key on first insert. From then on, local
//   id == server id, so plain upsert-by-id sync works exactly like WatermelonDB expects.
//
// - `transactions` CANNOT use that convention: rows are only ever created by calling
//   apply_transaction()/apply_transfer() (both SECURITY DEFINER RPCs from
//   0002_apply_transaction.sql, which this function must not bypass — that would let a
//   client write balances directly). Those RPCs generate their OWN row id server-side.
//   So the local WatermelonDB row (keyed by its own local id) and the server row (keyed
//   by a different, server-generated id) are never the same id — the local `server_id`
//   field on the Transaction model exists specifically to bridge this gap. This function
//   returns a `client_id -> server row id` map in the push response so the client can
//   reconcile `server_id`/`sync_status` locally without WatermelonDB ever needing the
//   two ids to match. `client_id` is the idempotency key already enforced by the unique
//   (user_id, client_id) constraint, so retried pushes never double-apply
//   (spec: Sync Without Duplication).
//
// - Accounts are column-privilege-restricted: `authenticated` may only UPDATE
//   `name`/`type` directly (0001_init.sql) — `balance` is only ever mutated by the RPCs.
//   So account "updated" pushes (renames) send only {name, type}; "created" pushes send
//   the full row including the starting `balance`.
//
// - No hard-delete propagation on pull yet (no tombstone/deleted_at column in Phase 1
//   schema) — a delete on device A will delete the server row (and de-list it locally on
//   A), but a device B that already pulled it before the delete won't learn about the
//   deletion until a tombstone mechanism is added. Documented limitation, not a Phase 2
//   blocker for a single-device-per-account MVP.

// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isoFromMs(ms: number): string {
  return new Date(ms).toISOString();
}

function msFromIso(iso: string): number {
  return new Date(iso).getTime();
}

// ---------------------------------------------------------------------------
// Row <-> WatermelonDB DirtyRaw mapping
// ---------------------------------------------------------------------------

function mapAccountToRaw(row: any) {
  return {
    id: row.id,
    server_id: row.id,
    name: row.name,
    type: row.type,
    balance_centavos: row.balance,
    created_at: msFromIso(row.created_at),
    updated_at: msFromIso(row.updated_at),
  };
}

function mapCategoryToRaw(row: any) {
  return {
    id: row.id,
    server_id: row.id,
    name: row.name,
    kind: row.kind,
    created_at: msFromIso(row.created_at),
    updated_at: msFromIso(row.updated_at),
  };
}

function mapBudgetToRaw(row: any) {
  return {
    id: row.id,
    server_id: row.id,
    category_id: row.category_id,
    month: msFromIso(row.month),
    limit_centavos: row.limit_centavos,
    alert_80_sent: row.alert_80_sent,
    alert_100_sent: row.alert_100_sent,
    created_at: msFromIso(row.created_at),
    updated_at: msFromIso(row.updated_at),
  };
}

function mapTransactionToRaw(row: any) {
  return {
    id: row.id,
    server_id: row.id,
    account_id: row.account_id,
    category_id: row.category_id,
    type: row.type,
    amount_centavos: row.amount_centavos,
    payment_method: row.payment_method,
    note: row.note,
    occurred_at: msFromIso(row.occurred_at),
    transfer_id: row.transfer_id,
    reverses_transaction_id: row.reverses_transaction_id,
    client_id: row.client_id,
    sync_status: "synced",
    created_at: msFromIso(row.created_at),
    updated_at: msFromIso(row.created_at), // transactions have no updated_at (insert-only)
  };
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function handlePull(supabase: SupabaseClient, url: URL): Promise<Response> {
  const lastPulledAtMs = Number(url.searchParams.get("last_pulled_at") ?? "0");
  const sinceIso = isoFromMs(lastPulledAtMs);

  const [accountsRes, categoriesRes, budgetsRes, txRes] = await Promise.all([
    supabase.from("accounts").select("*").gt("updated_at", sinceIso),
    supabase.from("categories").select("*").gt("updated_at", sinceIso),
    supabase.from("budgets").select("*").gt("updated_at", sinceIso),
    supabase.from("transactions").select("*").gt("created_at", sinceIso),
  ]);

  for (const res of [accountsRes, categoriesRes, budgetsRes, txRes]) {
    if (res.error) return json({ error: res.error.message }, 500);
  }

  const changes = {
    accounts: { created: [], updated: (accountsRes.data ?? []).map(mapAccountToRaw), deleted: [] },
    categories: { created: [], updated: (categoriesRes.data ?? []).map(mapCategoryToRaw), deleted: [] },
    budgets: { created: [], updated: (budgetsRes.data ?? []).map(mapBudgetToRaw), deleted: [] },
    // Bucketed as "created" — the client-side pullChanges wrapper filters out rows whose
    // client_id it already has locally before handing this off to WatermelonDB (see
    // mobile/src/sync/index.ts for why: local id != server id for this table).
    transactions: { created: (txRes.data ?? []).map(mapTransactionToRaw), updated: [], deleted: [] },
  };

  return json({ changes, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

async function handlePush(supabase: SupabaseClient, userId: string, body: any): Promise<Response> {
  const rejected: Record<string, string[]> = {};
  const reject = (table: string, id: string) => {
    (rejected[table] ??= []).push(id);
  };

  // accounts / categories / budgets — shared-id upsert (see file header).
  const accountsChanges = body?.changes?.accounts;
  if (accountsChanges) {
    for (const record of accountsChanges.created ?? []) {
      const { error } = await supabase.from("accounts").insert({
        id: record.id,
        user_id: userId,
        name: record.name,
        type: record.type,
        balance: record.balance_centavos,
      });
      if (error) reject("accounts", record.id);
    }
    for (const record of accountsChanges.updated ?? []) {
      // Column-privilege-restricted: only name/type may be updated directly (balance is RPC-only).
      const { error } = await supabase
        .from("accounts")
        .update({ name: record.name, type: record.type })
        .eq("id", record.id);
      if (error) reject("accounts", record.id);
    }
    for (const id of accountsChanges.deleted ?? []) {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) reject("accounts", id);
    }
  }

  const categoriesChanges = body?.changes?.categories;
  if (categoriesChanges) {
    for (const record of categoriesChanges.created ?? []) {
      const { error } = await supabase
        .from("categories")
        .insert({ id: record.id, user_id: userId, name: record.name, kind: record.kind });
      if (error) reject("categories", record.id);
    }
    for (const record of categoriesChanges.updated ?? []) {
      const { error } = await supabase
        .from("categories")
        .update({ name: record.name, kind: record.kind })
        .eq("id", record.id);
      if (error) reject("categories", record.id);
    }
    for (const id of categoriesChanges.deleted ?? []) {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) reject("categories", id);
    }
  }

  const budgetsChanges = body?.changes?.budgets;
  if (budgetsChanges) {
    for (const record of budgetsChanges.created ?? []) {
      // NOTE: `record.month` is the UTC instant of local midnight on the 1st (see
      // mobile/src/lib/timezone.ts). Slicing its ISO string to a date is only guaranteed
      // correct for timezones BEHIND UTC (e.g. America/Lima, UTC-5) — the app's only
      // supported default. A timezone AHEAD of UTC would need the calendar date computed
      // with the user's timezone, not read off the UTC-formatted instant. Flagged as a
      // known limitation rather than fixed here, since Lima is the only target timezone.
      const { error } = await supabase.from("budgets").insert({
        id: record.id,
        user_id: userId,
        category_id: record.category_id,
        month: isoFromMs(record.month).slice(0, 10),
        limit_centavos: record.limit_centavos,
        alert_80_sent: record.alert_80_sent ?? false,
        alert_100_sent: record.alert_100_sent ?? false,
      });
      if (error) reject("budgets", record.id);
    }
    for (const record of budgetsChanges.updated ?? []) {
      const { error } = await supabase
        .from("budgets")
        .update({ limit_centavos: record.limit_centavos })
        .eq("id", record.id);
      if (error) reject("budgets", record.id);
    }
    for (const id of budgetsChanges.deleted ?? []) {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) reject("budgets", id);
    }
  }

  // transactions — insert-only, always via apply_transaction/apply_transfer RPCs.
  const clientIdToServerId: Record<string, string> = {};
  const txChanges = body?.changes?.transactions;
  if (txChanges) {
    const creates: any[] = txChanges.created ?? [];
    const transferGroups = new Map<string, any[]>();
    const singles: any[] = [];

    for (const record of creates) {
      if (record.type === "transfer" && record.transfer_id) {
        const arr = transferGroups.get(record.transfer_id) ?? [];
        arr.push(record);
        transferGroups.set(record.transfer_id, arr);
      } else {
        singles.push(record);
      }
    }

    for (const record of singles) {
      const { data, error } = await supabase.rpc("apply_transaction", {
        p_account_id: record.account_id,
        p_type: record.type,
        p_amount_centavos: record.amount_centavos,
        p_category_id: record.category_id ?? null,
        p_payment_method: record.payment_method ?? null,
        p_note: record.note ?? null,
        p_occurred_at: isoFromMs(record.occurred_at),
        p_client_id: record.client_id,
      });
      if (error || !data) {
        reject("transactions", record.id);
        continue;
      }
      clientIdToServerId[record.client_id] = (data as any).id;
    }

    for (const [, pair] of transferGroups) {
      const debit = pair.find((r) => String(r.client_id).endsWith(":debit"));
      const credit = pair.find((r) => String(r.client_id).endsWith(":credit"));
      if (!debit || !credit) {
        pair.forEach((r) => reject("transactions", r.id));
        continue;
      }
      const baseClientId = String(debit.client_id).replace(/:debit$/, "");
      const { data, error } = await supabase.rpc("apply_transfer", {
        p_from_account_id: debit.account_id,
        p_to_account_id: credit.account_id,
        p_amount_centavos: debit.amount_centavos,
        p_occurred_at: isoFromMs(debit.occurred_at),
        p_client_id: baseClientId,
        p_note: debit.note ?? null,
      });
      if (error || !data) {
        pair.forEach((r) => reject("transactions", r.id));
        continue;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.debit?.id) clientIdToServerId[debit.client_id] = row.debit.id;
      if (row?.credit?.id) clientIdToServerId[credit.client_id] = row.credit.id;
    }

    // "updated"/"deleted" on transactions should never happen (grants are insert-only) —
    // if the client somehow queued one, reject it loudly instead of silently dropping it.
    for (const record of txChanges.updated ?? []) reject("transactions", record.id);
    for (const id of txChanges.deleted ?? []) reject("transactions", id);
  }

  return json({
    experimentalRejectedIds: Object.keys(rejected).length > 0 ? rejected : undefined,
    transactionServerIds: clientIdToServerId,
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // Request-scoped client (forwards the caller's JWT) so RLS and auth.uid() inside the
  // apply_transaction/apply_transfer RPCs resolve to the CALLING user, never a service role.
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

  if (req.method === "GET" && url.pathname.endsWith("/pull")) {
    return handlePull(supabase, url);
  }
  if (req.method === "POST" && url.pathname.endsWith("/push")) {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "invalid JSON body" }, 400);
    return handlePush(supabase, userData.user.id, body);
  }
  return json({ error: "not found" }, 404);
});
