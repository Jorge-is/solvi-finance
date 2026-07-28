import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import Account from "../../db/models/Account";
import { observeAccounts } from "../../data/accounts";
import { useObservable } from "../../lib/useObservable";
import { centavosToDisplay } from "../../lib/money";
import PendingSyncBanner from "../../components/PendingSyncBanner";

export type AccountListScreenProps = {
  onCreateAccount: () => void;
  onSelectAccount: (account: Account) => void;
};

/** spec: Account Creation, Total Balance. */
export default function AccountListScreen({ onCreateAccount, onSelectAccount }: AccountListScreenProps) {
  const accounts = useObservable(() => observeAccounts(), [], [] as Account[]);
  const total = accounts.reduce((sum, a) => sum + a.balanceCentavos, 0);

  return (
    <View style={styles.container}>
      <PendingSyncBanner />
      <View style={styles.header}>
        <Text style={styles.totalLabel}>Balance total</Text>
        <Text style={styles.totalAmount}>{centavosToDisplay(total)}</Text>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => onSelectAccount(item)}>
            <View>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowType}>{item.type}</Text>
            </View>
            <Text style={styles.rowBalance}>{centavosToDisplay(item.balanceCentavos)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Sin cuentas todavía. Crea la primera.</Text>}
      />

      <TouchableOpacity style={styles.addButton} onPress={onCreateAccount}>
        <Text style={styles.addButtonText}>+ Nueva cuenta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, alignItems: "center" },
  totalLabel: { fontSize: 14, color: "#6b7280" },
  totalAmount: { fontSize: 32, fontWeight: "700" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowName: { fontSize: 16, fontWeight: "600" },
  rowType: { fontSize: 13, color: "#6b7280" },
  rowBalance: { fontSize: 16, fontWeight: "600" },
  empty: { textAlign: "center", color: "#9ca3af", marginTop: 40 },
  addButton: { margin: 20, backgroundColor: "#111827", borderRadius: 8, padding: 14, alignItems: "center" },
  addButtonText: { color: "white", fontWeight: "600", fontSize: 16 },
});
