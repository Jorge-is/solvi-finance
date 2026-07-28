import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import Category from "../../db/models/Category";
import { observeCategories } from "../../data/categories";
import { createBudget } from "../../data/budgets";
import { useObservable } from "../../lib/useObservable";
import { getUserTimezone } from "../../lib/profile";
import { localYearMonth, zonedTimeToUtc } from "../../lib/timezone";
import { solesStringToCentavos } from "../../lib/money";

export type BudgetFormScreenProps = {
  onDone: () => void;
};

/** spec: Budget Definition — monthly limit (PEN centavos) for a category, scoped to the current local month. */
export default function BudgetFormScreen({ onDone }: BudgetFormScreenProps) {
  const categories = useObservable(() => observeCategories(), [], [] as Category[]);
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [limit, setLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!categoryId && expenseCategories.length > 0) setCategoryId(expenseCategories[0].id);
  }, [expenseCategories, categoryId]);

  async function handleSave() {
    setError(null);
    if (!categoryId) {
      setError("Crea una categoría de gasto primero.");
      return;
    }
    let limitCentavos: number;
    try {
      limitCentavos = solesStringToCentavos(limit);
      if (limitCentavos <= 0) throw new Error("El límite debe ser mayor a cero.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Límite inválido.");
      return;
    }

    setSaving(true);
    try {
      const timezone = await getUserTimezone();
      const { year, month } = localYearMonth(new Date(), timezone);
      const monthDate = zonedTimeToUtc(year, month, 1, 0, 0, 0, timezone);
      await createBudget({ categoryId, month: monthDate, limitCentavos });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el presupuesto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Nuevo presupuesto</Text>

      <Text style={styles.sectionLabel}>Categoría</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {expenseCategories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, c.id === categoryId && styles.chipSelected]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={[styles.chipText, c.id === categoryId && styles.chipTextSelected]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Límite mensual (S/)</Text>
      <TextInput style={styles.input} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="0.00" />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? "Guardando…" : "Guardar"}</Text>
      </TouchableOpacity>
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
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  error: { color: "#dc2626", marginTop: 8 },
  saveButton: { backgroundColor: "#111827", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 16 },
  saveButtonText: { color: "white", fontWeight: "700", fontSize: 16 },
});
