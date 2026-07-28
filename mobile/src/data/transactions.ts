import { Q } from "@nozbe/watermelondb";

import { database } from "../db";
import Account from "../db/models/Account";
import Transaction, { TransactionType } from "../db/models/Transaction";
import { newClientId } from "../lib/id";
import { requestSync } from "../sync";

const transactions = () => database.get<Transaction>("transactions");
const accounts = () => database.get<Account>("accounts");

export function observeRecentTransactions(limit = 100) {
  return transactions()
    .query(Q.sortBy("occurred_at", Q.desc), Q.take(limit))
    .observe();
}

export type QuickEntryInput = {
  accountId: string;
  categoryId: string | null;
  type: Extract<TransactionType, "income" | "expense">;
  amountCentavos: number;
  paymentMethod: string | null;
  note: string | null;
  occurredAt?: Date;
};

/**
 * Records an income/expense movement offline-first (spec: Fast Movement Entry, Offline Creation).
 * Writes to local WatermelonDB immediately with sync_status = "pending" and a client-generated
 * `client_id` (idempotency key, mirrors what apply_transaction() expects server-side), then
 * optimistically applies the same balance delta apply_transaction() would apply, so the UI
 * reflects the new balance instantly without waiting for a round trip. The eventual sync pass
 * reconciles the local balance with the server-materialized truth.
 */
export async function createLocalTransaction(input: QuickEntryInput): Promise<Transaction> {
  if (!Number.isInteger(input.amountCentavos) || input.amountCentavos <= 0) {
    throw new Error("amountCentavos must be a positive integer");
  }
  const clientId = newClientId();
  const occurredAt = input.occurredAt ?? new Date();
  const delta = input.type === "expense" ? -input.amountCentavos : input.amountCentavos;

  const tx = await database.write(async (writer) => {
    const account = await accounts().find(input.accountId);

    const created = transactions().prepareCreate((t) => {
      t.accountId = input.accountId;
      t.categoryId = input.categoryId;
      t.type = input.type;
      t.amountCentavos = input.amountCentavos;
      t.paymentMethod = input.paymentMethod;
      t.note = input.note;
      t.occurredAt = occurredAt;
      t.transferId = null;
      t.reversesTransactionId = null;
      t.clientId = clientId;
      t.pendingSyncStatus = "pending";
      t.serverId = null;
    });

    const updatedAccount = account.prepareUpdate((a) => {
      a.balanceCentavos = a.balanceCentavos + delta;
    });

    await writer.batch(created, updatedAccount);
    return created;
  });

  requestSync();
  return tx;
}

/**
 * Correction without data loss (spec: Account Correction Without Data Loss): inserts a reversal
 * of the original movement plus a new corrected movement — never mutates the original row.
 */
export async function correctTransaction(
  original: Transaction,
  corrected: Omit<QuickEntryInput, "accountId"> & { accountId?: string }
): Promise<{ reversal: Transaction; replacement: Transaction }> {
  const accountId = corrected.accountId ?? original.accountId;
  const reversalClientId = newClientId();
  const replacementClientId = newClientId();
  const reversalDelta = original.type === "expense" ? original.amountCentavos : -original.amountCentavos;
  const replacementDelta = corrected.type === "expense" ? -corrected.amountCentavos : corrected.amountCentavos;

  const result = await database.write(async (writer) => {
    const account = await accounts().find(accountId);

    const reversal = transactions().prepareCreate((t) => {
      t.accountId = original.accountId;
      t.categoryId = original.categoryId;
      t.type = original.type === "expense" ? "income" : "expense";
      t.amountCentavos = original.amountCentavos;
      t.paymentMethod = original.paymentMethod;
      t.note = `Reversal of ${original.id}`;
      t.occurredAt = new Date();
      t.transferId = null;
      t.reversesTransactionId = original.id;
      t.clientId = reversalClientId;
      t.pendingSyncStatus = "pending";
      t.serverId = null;
    });

    const replacement = transactions().prepareCreate((t) => {
      t.accountId = accountId;
      t.categoryId = corrected.categoryId;
      t.type = corrected.type;
      t.amountCentavos = corrected.amountCentavos;
      t.paymentMethod = corrected.paymentMethod;
      t.note = corrected.note;
      t.occurredAt = corrected.occurredAt ?? new Date();
      t.transferId = null;
      t.reversesTransactionId = null;
      t.clientId = replacementClientId;
      t.pendingSyncStatus = "pending";
      t.serverId = null;
    });

    const updatedAccount = account.prepareUpdate((a) => {
      a.balanceCentavos = a.balanceCentavos + reversalDelta + replacementDelta;
    });

    await writer.batch(reversal, replacement, updatedAccount);
    return { reversal, replacement };
  });

  requestSync();
  return { reversal: result.reversal, replacement: result.replacement };
}

export function observePendingOrFailedCount() {
  return transactions()
    .query(Q.where("sync_status", Q.oneOf(["pending", "failed"])))
    .observeCount();
}
