import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Account from "../../db/models/Account";
import { observeAccounts } from "../../data/accounts";
import { createLocalTransfer } from "../../data/transfers";
import { useObservable } from "../../lib/useObservable";
import { solesStringToCentavos } from "../../lib/money";
import PendingSyncBanner from "../../components/PendingSyncBanner";

export type TransferScreenProps = {
  onSaved: () => void;
};

/** spec: Transfers Between Accounts. */
export default function TransferScreen({ onSaved }: TransferScreenProps) {
  const accounts = useObservable(() => observeAccounts(), [], [] as Account[]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!fromId && accounts.length > 0) setFromId(accounts[0].id);
    if (!toId && accounts.length > 1) setToId(accounts[1].id);
  }, [accounts, fromId, toId]);

  async function handleSave() {
    setError(null);
    if (!fromId || !toId) {
      setError("Selecciona cuenta de origen y destino.");
      return;
    }
    if (fromId === toId) {
      setError("La cuenta de origen y destino deben ser distintas.");
      return;
    }
    let amountCentavos: number;
    try {
      amountCentavos = solesStringToCentavos(amount);
      if (amountCentavos <= 0) throw new Error("El monto debe ser mayor a cero.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Monto inválido.");
      return;
    }

    setSaving(true);
    try {
      await createLocalTransfer({ fromAccountId: fromId, toAccountId: toId, amountCentavos, note: note.trim() || null });
      setAmount("");
      setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la transferencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PendingSyncBanner />
      <Text style={styles.title}>Transferir</Text>

      <Text style={styles.sectionLabel}>Desde</Text>
      <AccountPicker accounts={accounts} selectedId={fromId} onSelect={setFromId} />

      <Text style={styles.sectionLabel}>Hacia</Text>
      <AccountPicker accounts={accounts} selectedId={toId} onSelect={setToId} />

      <TextInput
        style={styles.amountInput}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <TextInput style={styles.noteInput} placeholder="Nota (opcional)" value={note} onChangeText={setNote} />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Guardando…" : "Transferir"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function AccountPicker({
  accounts,
  selectedId,
  onSelect,
}: {
  accounts: Account[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
      {accounts.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={[styles.chip, a.id === selectedId && styles.chipSelected]}
          onPress={() => onSelect(a.id)}
        >
          <Text style={[styles.chipText, a.id === selectedId && styles.chipTextSelected]}>{a.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  sectionLabel: { fontSize: 13, color: "#6b7280", marginTop: 8 },
  chipRow: { flexDirection: "row" },
  chip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  chipSelected: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { color: "#111827" },
  chipTextSelected: { color: "white" },
  amountInput: { fontSize: 32, fontWeight: "700", textAlign: "center", paddingVertical: 12, marginTop: 12 },
  noteInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginTop: 8 },
  error: { color: "#dc2626", marginTop: 8 },
  saveButton: { backgroundColor: "#111827", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "white", fontWeight: "700", fontSize: 16 },
});
