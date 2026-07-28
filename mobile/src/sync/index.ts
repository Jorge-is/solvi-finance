import NetInfo from "@react-native-community/netinfo";
import { Q } from "@nozbe/watermelondb";
import { synchronize } from "@nozbe/watermelondb/sync";
import type { SyncDatabaseChangeSet, SyncPullArgs, SyncPushArgs } from "@nozbe/watermelondb/sync";

import { database } from "../db";
import { schema } from "../db/schema";
import { supabase } from "../lib/supabase";
import Transaction from "../db/models/Transaction";
import { setSyncStatus } from "./syncStatus";

// Wires WatermelonDB's sync protocol to the `sync` Supabase Edge Function
// (supabase/functions/sync/index.ts). Runs on: reconnect (NetInfo listener below),
// and whenever a local write calls requestSync() (debounced).
//
// Per spec (transactions: "Sync failure is visible, not silent"), a failed sync
// NEVER deletes/clears the locally queued rows — WatermelonDB's own retry-on-next-sync
// behavior handles that, and rows keep their local `sync_status` field (set by the
// data/*.ts write helpers) until the edge function's response is reflected back
// (see supabase/functions/sync — successfully-applied rows come back with a
// `server_id`, which the app should treat as "synced" once observed on next pull).

function functionsBaseUrl(): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("EXPO_PUBLIC_SUPABASE_URL is not set");
  // Local Supabase CLI serves functions on a different port than the API; cloud
  // projects serve them at <ref>.functions.supabase.co OR <url>/functions/v1.
  // We use the `/functions/v1` path form, which works for both local `supabase start`
  // and hosted projects.
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!token) throw new Error("No active session — cannot sync");
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
    "Content-Type": "application/json",
  };
}

/**
 * `transactions` rows this device already has locally were created with a LOCAL
 * WatermelonDB id that differs from the server-generated row id (see the long comment
 * in supabase/functions/sync/index.ts for why apply_transaction/apply_transfer can't
 * use a client-supplied id). So before handing the edge function's pulled transactions
 * to WatermelonDB's synchronize(), we match them back to local rows by `client_id`
 * (the idempotency key, present on both sides) and reconcile `server_id`/`sync_status`
 * directly — WatermelonDB never sees them as "created" and never double-inserts.
 * Anything left over is genuinely new (created by another device) and is safe to
 * hand off as-is; its server id becomes its local id too, going forward.
 */
async function reconcileAndFilterPulledTransactions(changes: SyncDatabaseChangeSet): Promise<void> {
  const txChanges = (changes as Record<string, { created: any[]; updated: any[]; deleted: string[] } | undefined>)
    .transactions;
  if (!txChanges || txChanges.created.length === 0) return;

  const clientIds = txChanges.created.map((r) => r.client_id).filter(Boolean);
  if (clientIds.length === 0) return;

  const localMatches = await database
    .get<Transaction>("transactions")
    .query(Q.where("client_id", Q.oneOf(clientIds)))
    .fetch();
  const localByClientId = new Map(localMatches.map((t) => [t.clientId, t]));

  const stillNew: any[] = [];
  const toReconcile: Array<{ local: Transaction; serverId: string }> = [];
  for (const record of txChanges.created) {
    const local = localByClientId.get(record.client_id);
    if (local) {
      toReconcile.push({ local, serverId: record.server_id });
    } else {
      stillNew.push(record);
    }
  }

  if (toReconcile.length > 0) {
    await database.write(async (writer) => {
      const updates = toReconcile.map(({ local, serverId }) =>
        local.prepareUpdate((t) => {
          t.serverId = serverId;
          t.pendingSyncStatus = "synced";
        })
      );
      await writer.batch(...updates);
    });
  }

  txChanges.created = stillNew;
}

async function pullChanges({ lastPulledAt, schemaVersion, migration }: SyncPullArgs) {
  const headers = await authHeaders();
  const params = new URLSearchParams({
    last_pulled_at: String(lastPulledAt ?? 0),
    schema_version: String(schemaVersion),
  });
  const res = await fetch(`${functionsBaseUrl()}/sync/pull?${params.toString()}`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    throw new Error(`pullChanges failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { changes: SyncDatabaseChangeSet; timestamp: number };
  await reconcileAndFilterPulledTransactions(body.changes);
  return body;
}

async function pushChanges({ changes, lastPulledAt }: SyncPushArgs) {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBaseUrl()}/sync/push`, {
    method: "POST",
    headers,
    body: JSON.stringify({ changes, lastPulledAt }),
  });
  if (!res.ok) {
    throw new Error(`pushChanges failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json().catch(() => ({}))) as {
    experimentalRejectedIds?: Record<string, string[]>;
    transactionServerIds?: Record<string, string>;
  };

  // Reconcile local transaction rows with the server ids the RPCs just assigned, so the
  // UI can immediately show "synced" instead of waiting for the next pull to confirm it.
  const serverIdByClientId = body.transactionServerIds ?? {};
  const clientIds = Object.keys(serverIdByClientId);
  if (clientIds.length > 0) {
    const localRows = await database
      .get<Transaction>("transactions")
      .query(Q.where("client_id", Q.oneOf(clientIds)))
      .fetch();
    await database.write(async (writer) => {
      const updates = localRows.map((row) =>
        row.prepareUpdate((t) => {
          t.serverId = serverIdByClientId[row.clientId];
          t.pendingSyncStatus = "synced";
        })
      );
      await writer.batch(...updates);
    });
  }

  return { experimentalRejectedIds: body.experimentalRejectedIds };
}

let syncInFlight: Promise<void> | null = null;
let syncQueuedAgain = false;

async function runSyncOnce(): Promise<void> {
  setSyncStatus({ phase: "syncing" });
  try {
    await synchronize({
      database,
      pullChanges,
      pushChanges,
      migrationsEnabledAtVersion: schema.version,
    });
    setSyncStatus({ phase: "idle", lastSyncedAt: Date.now(), lastError: null });
  } catch (err) {
    // Never throw past this point silently — status is surfaced, rows stay "pending"/"failed"
    // in WatermelonDB (spec: "Sync failure is visible, not silent").
    setSyncStatus({ phase: "error", lastError: err instanceof Error ? err.message : String(err) });
  }
}

/** Debounced sync trigger — safe to call after every local write and on reconnect. */
export function requestSync(): void {
  if (syncInFlight) {
    syncQueuedAgain = true;
    return;
  }
  syncInFlight = runSyncOnce().finally(() => {
    syncInFlight = null;
    if (syncQueuedAgain) {
      syncQueuedAgain = false;
      requestSync();
    }
  });
}

let listenerRegistered = false;

/** Call once at app startup (Phase 3 wiring) — safe to call multiple times, only registers once. */
export function startSyncEngine(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;
  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      requestSync();
    }
  });
}

export { getSyncStatus, subscribeSyncStatus } from "./syncStatus";
export type { SyncStatusState, SyncPhase } from "./syncStatus";
