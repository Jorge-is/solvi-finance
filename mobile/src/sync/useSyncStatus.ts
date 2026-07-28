import { useSyncExternalStore } from "react";

import { getSyncStatus, subscribeSyncStatus, SyncStatusState } from "./syncStatus";

/** React hook exposing live sync status, so screens can render a "pending sync" / "sync failed" banner. */
export function useSyncStatus(): SyncStatusState {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
