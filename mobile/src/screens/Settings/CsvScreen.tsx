import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { exportAndShareCsv, pickAndImportCsv, CsvImportResult } from "../../data/csvImportExport";

/** spec: CSV Export, CSV Import. */
export default function CsvScreen() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      await exportAndShareCsv();
      setMessage("Exportación lista para compartir/guardar.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo exportar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    setMessage(null);
    setImportResult(null);
    try {
      const result = await pickAndImportCsv();
      if (result) {
        setImportResult(result);
        setMessage(`${result.importedCount} movimiento(s) importado(s).`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Exportar / Importar CSV</Text>

      <TouchableOpacity style={styles.button} onPress={handleExport} disabled={busy}>
        <Text style={styles.buttonText}>Exportar movimientos</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleImport} disabled={busy}>
        <Text style={styles.buttonText}>Importar movimientos</Text>
      </TouchableOpacity>

      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
      {message && <Text style={styles.message}>{message}</Text>}

      {importResult && importResult.errors.length > 0 && (
        <View style={styles.errorsBlock}>
          <Text style={styles.errorsTitle}>Filas con error ({importResult.errors.length}):</Text>
          {importResult.errors.map((e) => (
            <Text key={e.row} style={styles.errorLine}>
              Fila {e.row}: {e.reason}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  button: { backgroundColor: "#111827", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "white", fontWeight: "600", fontSize: 16 },
  message: { marginTop: 12, fontSize: 14, color: "#111827" },
  errorsBlock: { marginTop: 16, backgroundColor: "#fef2f2", borderRadius: 8, padding: 12 },
  errorsTitle: { fontWeight: "600", color: "#dc2626", marginBottom: 6 },
  errorLine: { color: "#991b1b", fontSize: 13 },
});
