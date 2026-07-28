// SDK 57 replaced expo-file-system's API with a new File/Directory/Paths model; the
// `legacy` entry point keeps the familiar readAsStringAsync/writeAsStringAsync API,
// which is all this module needs.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

import { database } from "../db";
import Account from "../db/models/Account";
import Category from "../db/models/Category";
import Transaction, { TransactionType } from "../db/models/Transaction";
import { CSV_HEADER, formatCsvRow, parseCsv } from "../lib/csv";
import { centavosToSolesString, solesStringToCentavos } from "../lib/money";
import { newClientId } from "../lib/id";
import { requestSync } from "../sync";

const transactions = () => database.get<Transaction>("transactions");
const accounts = () => database.get<Account>("accounts");
const categories = () => database.get<Category>("categories");

// ---------------------------------------------------------------------------
// Export (spec: CSV Export)
// ---------------------------------------------------------------------------

export async function exportMovementsToCsvString(): Promise<string> {
  const [allTransactions, allAccounts, allCategories] = await Promise.all([
    transactions().query().fetch(),
    accounts().query().fetch(),
    categories().query().fetch(),
  ]);
  const accountNameById = new Map(allAccounts.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(allCategories.map((c) => [c.id, c.name]));

  const lines = [formatCsvRow([...CSV_HEADER])];
  for (const t of allTransactions) {
    lines.push(
      formatCsvRow([
        t.occurredAt.toISOString(),
        t.type,
        accountNameById.get(t.accountId) ?? "",
        t.categoryId ? categoryNameById.get(t.categoryId) ?? "" : "",
        t.paymentMethod ?? "",
        centavosToSolesString(t.amountCentavos),
        t.note ?? "",
      ])
    );
  }
  return lines.join("\n");
}

/** Writes the CSV to a temporary file and opens the native share sheet so the user can save/send it. */
export async function exportAndShareCsv(): Promise<string> {
  const csv = await exportMovementsToCsvString();
  const path = `${FileSystem.cacheDirectory}finanzas-export-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: "text/csv", UTI: "public.comma-separated-values-text" });
  }
  return path;
}

// ---------------------------------------------------------------------------
// Import (spec: CSV Import) — validate each row, insert valid rows atomically as
// one batch, report invalid rows individually without blocking the valid ones or
// corrupting account balances (only the valid rows' deltas are ever applied).
// ---------------------------------------------------------------------------

export type CsvImportRowError = { row: number; reason: string };
export type CsvImportResult = {
  importedCount: number;
  errors: CsvImportRowError[];
};

type ValidatedRow = {
  rowNumber: number;
  accountId: string;
  categoryId: string | null;
  type: Extract<TransactionType, "income" | "expense">;
  amountCentavos: number;
  paymentMethod: string | null;
  note: string | null;
  occurredAt: Date;
};

export async function pickAndImportCsv(): Promise<CsvImportResult | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: "text/csv", copyToCacheDirectory: true });
  if (picked.canceled || picked.assets.length === 0) return null;
  const csvText = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return importMovementsFromCsvString(csvText);
}

export async function importMovementsFromCsvString(csvText: string): Promise<CsvImportResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { importedCount: 0, errors: [] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1);

  const [allAccounts, allCategories] = await Promise.all([
    accounts().query().fetch(),
    categories().query().fetch(),
  ]);
  const accountByName = new Map(allAccounts.map((a) => [a.name.trim().toLowerCase(), a]));
  const categoryByName = new Map(allCategories.map((c) => [c.name.trim().toLowerCase(), c]));

  const col = (name: string) => header.indexOf(name);
  const idx = {
    date: col("date"),
    type: col("type"),
    account: col("account"),
    category: col("category"),
    paymentMethod: col("payment_method"),
    amount: col("amount"),
    note: col("note"),
  };
  if (idx.date < 0 || idx.type < 0 || idx.account < 0 || idx.amount < 0) {
    return {
      importedCount: 0,
      errors: [{ row: 1, reason: "Missing required header columns: date, type, account, amount" }],
    };
  }

  const valid: ValidatedRow[] = [];
  const errors: CsvImportRowError[] = [];

  dataRows.forEach((fields, i) => {
    const rowNumber = i + 2; // 1 = header
    try {
      if (fields.every((f) => f.trim() === "")) return; // skip blank lines

      const dateStr = fields[idx.date]?.trim();
      const typeStr = fields[idx.type]?.trim().toLowerCase();
      const accountName = fields[idx.account]?.trim();
      const categoryName = idx.category >= 0 ? fields[idx.category]?.trim() : "";
      const paymentMethod = idx.paymentMethod >= 0 ? fields[idx.paymentMethod]?.trim() || null : null;
      const amountStr = fields[idx.amount]?.trim();
      const note = idx.note >= 0 ? fields[idx.note]?.trim() || null : null;

      if (typeStr !== "income" && typeStr !== "expense") {
        throw new Error(`Invalid type "${typeStr}" (expected income or expense)`);
      }
      const account = accountByName.get(accountName?.toLowerCase() ?? "");
      if (!account) {
        throw new Error(`Unknown account "${accountName}"`);
      }
      let categoryId: string | null = null;
      if (categoryName) {
        const category = categoryByName.get(categoryName.toLowerCase());
        if (!category) {
          throw new Error(`Unknown category "${categoryName}"`);
        }
        categoryId = category.id;
      }
      const amountCentavos = solesStringToCentavos(amountStr); // throws on non-numeric
      if (amountCentavos <= 0) {
        throw new Error(`Amount must be positive, got "${amountStr}"`);
      }
      const occurredAt = new Date(dateStr);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new Error(`Invalid date "${dateStr}"`);
      }

      valid.push({
        rowNumber,
        accountId: account.id,
        categoryId,
        type: typeStr,
        amountCentavos,
        paymentMethod,
        note,
        occurredAt,
      });
    } catch (err) {
      errors.push({ row: rowNumber, reason: err instanceof Error ? err.message : String(err) });
    }
  });

  if (valid.length === 0) {
    return { importedCount: 0, errors };
  }

  // Atomic insert of the valid batch: one WatermelonDB write, one balance delta per
  // affected account, computed from ONLY the valid rows so invalid rows never touch balances.
  await database.write(async (writer) => {
    const deltaByAccount = new Map<string, number>();
    const recordsToBatch: Array<Transaction | Account> = [];

    for (const row of valid) {
      const created = transactions().prepareCreate((t) => {
        t.accountId = row.accountId;
        t.categoryId = row.categoryId;
        t.type = row.type;
        t.amountCentavos = row.amountCentavos;
        t.paymentMethod = row.paymentMethod;
        t.note = row.note;
        t.occurredAt = row.occurredAt;
        t.transferId = null;
        t.reversesTransactionId = null;
        t.clientId = newClientId();
        t.pendingSyncStatus = "pending";
        t.serverId = null;
      });
      recordsToBatch.push(created);
      const delta = row.type === "expense" ? -row.amountCentavos : row.amountCentavos;
      deltaByAccount.set(row.accountId, (deltaByAccount.get(row.accountId) ?? 0) + delta);
    }

    for (const [accountId, delta] of deltaByAccount) {
      const account = await accounts().find(accountId);
      recordsToBatch.push(
        account.prepareUpdate((a) => {
          a.balanceCentavos = a.balanceCentavos + delta;
        })
      );
    }

    await writer.batch(...recordsToBatch);
  });

  requestSync();
  return { importedCount: valid.length, errors };
}
