import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Account from "../../db/models/Account";
import Category from "../../db/models/Category";
import { observeAccounts } from "../../data/accounts";
import { observeCategories } from "../../data/categories";
import { createLocalTransaction } from "../../data/transactions";
import { useObservable } from "../../lib/useObservable";
import { solesStringToCentavos } from "../../lib/money";
import PendingSyncBanner from "../../components/PendingSyncBanner";

const PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "yape/plin"] as const;

export type QuickEntryScreenProps = {
  onSaved: () => void;
};

/**
 * spec: Fast Movement Entry — "3 steps or fewer from opening the app". Every field
 * defaults to a sensible pre-selection (first account, first category matching the
 * chosen type) so the minimum interaction is: type amount -> tap Save. Choosing a
 * different account/category/payment method is one tap each, still well under
 * a full multi-screen wizard.
 */
export default function QuickEntryScreen({ onSaved }: QuickEntryScreenProps) {
  const accounts = useObservable(() => observeAccounts(), [], [] as Account[]);
  const categories = useObservable(() => observeCategories(), [], [] as Category[]);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const categoriesForType = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);

  useEffect(() => {
    // Reset/re-pick category when the type changes so it always matches income/expense.
    if (categoriesForType.length > 0) {
      if (!categoriesForType.some((c) => c.id === categoryId)) {
        setCategoryId(categoriesForType[0].id);
      }
    } else {
      setCategoryId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, categoriesForType]);

  async function handleSave() {
    setError(null);
    if (!accountId) {
      setError("Crea una cuenta primero.");
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
      await createLocalTransaction({
        accountId,
        categoryId,
        type,
        amountCentavos,
        paymentMethod,
        note: note.trim() || null,
      });
      setAmount("");
      setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PendingSyncBanner />

      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeButton, type === "expense" && styles.typeButtonExpenseActive]}
          onPress={() => setType("expense")}
        >
          <Text style={[styles.typeButtonText, type === "expense" && styles.typeButtonTextActive]}>Gasto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeButton, type === "income" && styles.typeButtonIncomeActive]}
          onPress={() => setType("income")}
        >
          <Text style={[styles.typeButtonText, type === "income" && styles.typeButtonTextActive]}>Ingreso</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.amountInput}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
        testID="quick-entry-amount"
      />

      <Text style={styles.sectionLabel}>Cuenta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} selected={a.id === accountId} onPress={() => setAccountId(a.id)} />
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {categoriesForType.map((c) => (
          <Chip key={c.id} label={c.name} selected={c.id === categoryId} onPress={() => setCategoryId(c.id)} />
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Método de pago</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {PAYMENT_METHODS.map((m) => (
          <Chip key={m} label={m} selected={m === paymentMethod} onPress={() => setPaymentMethod(m)} />
        ))}
      </ScrollView>

      <TextInput style={styles.noteInput} placeholder="Nota (opcional)" value={note} onChangeText={setNote} />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Guardando…" : "Guardar"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 8 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeButton: { flex: 1, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, alignItems: "center" },
  typeButtonExpenseActive: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
  typeButtonIncomeActive: { backgroundColor: "#059669", borderColor: "#059669" },
  typeButtonText: { fontWeight: "600", color: "#111827" },
  typeButtonTextActive: { color: "white" },
  amountInput: { fontSize: 40, fontWeight: "700", textAlign: "center", paddingVertical: 16 },
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
  noteInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, marginTop: 8 },
  error: { color: "#dc2626", marginTop: 8 },
  saveButton: { backgroundColor: "#111827", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "white", fontWeight: "700", fontSize: 16 },
});
