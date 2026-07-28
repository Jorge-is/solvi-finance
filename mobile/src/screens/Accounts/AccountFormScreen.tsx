import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Account, { AccountType } from "../../db/models/Account";
import { createAccount, deleteAccount, renameAccount } from "../../data/accounts";
import { solesStringToCentavos } from "../../lib/money";

const ACCOUNT_TYPES: AccountType[] = ["efectivo", "banco", "yape", "plin"];

export type AccountFormScreenProps = {
  /** Pass an existing account to edit it; omit to create a new one. */
  account?: Account;
  onDone: () => void;
};

/** spec: Account Creation. */
export default function AccountFormScreen({ account, onDone }: AccountFormScreenProps) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "efectivo");
  const [startingBalance, setStartingBalance] = useState("0");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    try {
      if (account) {
        await renameAccount(account, name.trim(), type);
      } else {
        const startingBalanceCentavos = solesStringToCentavos(startingBalance || "0");
        await createAccount({ name: name.trim(), type, startingBalanceCentavos });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cuenta.");
    }
  }

  function handleDelete() {
    if (!account) return;
    Alert.alert("Eliminar cuenta", `¿Eliminar "${account.name}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await deleteAccount(account);
          onDone();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej. Yape" />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.typeRow}>
        {ACCOUNT_TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.typeChip, type === t && styles.typeChipSelected]}
            onPress={() => setType(t)}
          >
            <Text style={[styles.typeChipText, type === t && styles.typeChipTextSelected]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!account && (
        <>
          <Text style={styles.label}>Balance inicial (S/)</Text>
          <TextInput
            style={styles.input}
            value={startingBalance}
            onChangeText={setStartingBalance}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Guardar</Text>
      </TouchableOpacity>

      {account && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Eliminar cuenta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  label: { fontSize: 13, color: "#6b7280", marginTop: 12 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  typeChipSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  typeChipText: { color: "#111827" },
  typeChipTextSelected: { color: "white" },
  error: { color: "#dc2626", marginTop: 8 },
  saveButton: { backgroundColor: "#111827", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 24 },
  saveButtonText: { color: "white", fontWeight: "600", fontSize: 16 },
  deleteButton: { padding: 14, alignItems: "center", marginTop: 8 },
  deleteButtonText: { color: "#dc2626", fontWeight: "600" },
});
