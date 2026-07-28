// Tiny pub-sub store for sync status — no external state library needed for this.
// UI subscribes via `useSyncStatus()` so pending/failed sync is always visible
// (spec: "Sync failure is visible, not silent" — never drop it silently).

export type SyncPhase = "idle" | "syncing" | "error";

export type SyncStatusState = {
  phase: SyncPhase;
  lastSyncedAt: number | null;
  lastError: string | null;
};

let state: SyncStatusState = { phase: "idle", lastSyncedAt: null, lastError: null };
const listeners = new Set<(s: SyncStatusState) => void>();

export function getSyncStatus(): SyncStatusState {
  return state;
}

export function setSyncStatus(next: Partial<SyncStatusState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l(state));
}

export function subscribeSyncStatus(listener: (s: SyncStatusState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
