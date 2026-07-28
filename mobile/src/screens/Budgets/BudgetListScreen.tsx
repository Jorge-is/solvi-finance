import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Budget from "../../db/models/Budget";
import Category from "../../db/models/Category";
import { observeBudgetsForMonth, spentForCategoryInMonth } from "../../data/budgets";
import { observeCategories } from "../../data/categories";
import { useObservable } from "../../lib/useObservable";
import { getUserTimezone } from "../../lib/profile";
import { localYearMonth, zonedTimeToUtc } from "../../lib/timezone";
import { centavosToDisplay, percentOf } from "../../lib/money";
import PendingSyncBanner from "../../components/PendingSyncBanner";

export type BudgetListScreenProps = {
  onCreateBudget: () => void;
};

/** spec: Budget Definition, Budget Evaluation Against Spending. */
export default function BudgetListScreen({ onCreateBudget }: BudgetListScreenProps) {
  const [timezone, setTimezone] = useState("America/Lima");
  const [monthStartMs, setMonthStartMs] = useState<number | null>(null);
  const [spentByBudget, setSpentByBudget] = useState<Record<string, number>>({});

  const categories = useObservable(() => observeCategories(), [], [] as Category[]);
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  useEffect(() => {
    (async () => {
      const tz = await getUserTimezone();
      setTimezone(tz);
      const { year, month } = localYearMonth(new Date(), tz);
      setMonthStartMs(zonedTimeToUtc(year, month, 1, 0, 0, 0, tz).getTime());
    })();
  }, []);

  const budgets = useObservable(
    () => observeBudgetsForMonth(monthStartMs ?? 0),
    [monthStartMs],
    [] as Budget[]
  );

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        budgets.map(async (b) => [b.id, await spentForCategoryInMonth(b.categoryId, timezone)] as const)
      );
      setSpentByBudget(Object.fromEntries(entries));
    })();
  }, [budgets, timezone]);

  return (
    <View style={styles.container}>
      <PendingSyncBanner />
      <FlatList
        data={budgets}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => {
          const spent = spentByBudget[item.id] ?? 0;
          const pct = percentOf(spent, item.limitCentavos);
          return (
            <View style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.categoryName}>{categoryNameById.get(item.categoryId) ?? "—"}</Text>
                <Text style={styles.amounts}>
                  {centavosToDisplay(spent)} / {centavosToDisplay(item.limitCentavos)}
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(pct, 100)}%` },
                    pct >= 100 ? styles.progressOver : pct >= 80 ? styles.progressWarn : styles.progressOk,
                  ]}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Sin presupuestos este mes.</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={onCreateBudget}>
        <Text style={styles.addButtonText}>+ Nuevo presupuesto</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { paddingVertical: 12, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  categoryName: { fontSize: 16, fontWeight: "600" },
  amounts: { fontSize: 13, color: "#6b7280" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#f3f4f6", overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressOk: { backgroundColor: "#059669" },
  progressWarn: { backgroundColor: "#d97706" },
  progressOver: { backgroundColor: "#dc2626" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
  addButton: { margin: 20, backgroundColor: "#111827", borderRadius: 8, padding: 14, alignItems: "center" },
  addButtonText: { color: "white", fontWeight: "600", fontSize: 16 },
});
