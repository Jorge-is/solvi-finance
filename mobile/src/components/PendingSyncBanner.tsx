import { StyleSheet, Text, View } from "react-native";

import { useSyncStatus } from "../sync/useSyncStatus";

/**
 * Always-visible sync state banner (spec: "Sync failure is visible, not silent").
 * Renders nothing when everything is synced and idle.
 */
export default function PendingSyncBanner() {
  const status = useSyncStatus();

  if (status.phase === "idle") return null;

  return (
    <View style={[styles.banner, status.phase === "error" ? styles.error : styles.syncing]}>
      <Text style={styles.text}>
        {status.phase === "syncing" ? "Sincronizando…" : `Error al sincronizar: ${status.lastError ?? "desconocido"}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 12 },
  syncing: { backgroundColor: "#dbeafe" },
  error: { backgroundColor: "#fecaca" },
  text: { fontSize: 13, color: "#111827" },
});
