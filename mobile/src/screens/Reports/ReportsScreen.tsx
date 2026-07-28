import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { categoryBreakdown, CashFlowReport, CategoryBreakdownRow, monthlyCashFlow } from "../../data/reports";
import { getUserTimezone } from "../../lib/profile";
import { localYearMonth } from "../../lib/timezone";
import { centavosToDisplay } from "../../lib/money";

/** spec: Monthly Cash Flow Report, Spending by Category Report, Transfers Excluded from Reports. */
export default function ReportsScreen() {
  const [timezone, setTimezone] = useState("America/Lima");
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownRow[]>([]);

  useEffect(() => {
    (async () => {
      const tz = await getUserTimezone();
      setTimezone(tz);
      const ym = localYearMonth(new Date(), tz);
      setYear(ym.year);
      setMonth(ym.month);
    })();
  }, []);

  useEffect(() => {
    if (year === null || month === null) return;
    (async () => {
      const [cf, cb] = await Promise.all([
        monthlyCashFlow(year, month, timezone),
        categoryBreakdown(year, month, timezone),
      ]);
      setCashFlow(cf);
      setBreakdown(cb);
    })();
  }, [year, month, timezone]);

  function shiftMonth(delta: number) {
    if (year === null || month === null) return;
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    } else if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setYear(newYear);
    setMonth(newMonth);
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => shiftMonth(-1)}>
          <Text style={styles.monthNavArrow}>{"‹"}</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>
          {year !== null && month !== null ? `${String(month).padStart(2, "0")}/${year}` : "…"}
        </Text>
        <TouchableOpacity onPress={() => shiftMonth(1)}>
          <Text style={styles.monthNavArrow}>{"›"}</Text>
        </TouchableOpacity>
      </View>

      {cashFlow && (
        <View style={styles.cashFlowCard}>
          <CashFlowStat label="Ingresos" value={cashFlow.incomeCentavos} color="#059669" />
          <CashFlowStat label="Gastos" value={cashFlow.expenseCentavos} color="#dc2626" />
          <CashFlowStat label="Neto" value={cashFlow.netCentavos} color="#111827" />
        </View>
      )}

      <Text style={styles.sectionTitle}>Gastos por categoría</Text>
      <FlatList
        data={breakdown}
        keyExtractor={(row) => row.categoryId ?? "uncategorized"}
        renderItem={({ item }) => (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownName}>{item.categoryName}</Text>
            <Text style={styles.breakdownAmount}>{centavosToDisplay(item.totalCentavos)}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin gastos este mes.</Text>}
      />
    </View>
  );
}

function CashFlowStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{centavosToDisplay(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  monthNavArrow: { fontSize: 28, color: "#111827", paddingHorizontal: 12 },
  monthLabel: { fontSize: 18, fontWeight: "700" },
  cashFlowCard: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 16 },
  statBlock: { alignItems: "center" },
  statLabel: { fontSize: 13, color: "#6b7280" },
  statValue: { fontSize: 18, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: 12 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  breakdownName: { fontSize: 15 },
  breakdownAmount: { fontSize: 15, fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 20 },
});
