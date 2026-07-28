import { database } from "../db";
import Account from "../db/models/Account";
import Transaction from "../db/models/Transaction";
import { newClientId } from "../lib/id";
import { requestSync } from "../sync";

const transactions = () => database.get<Transaction>("transactions");
const accounts = () => database.get<Account>("accounts");

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amountCentavos: number;
  note?: string | null;
  occurredAt?: Date;
};

/**
 * Records a transfer offline-first, matching apply_transfer() semantics exactly:
 * two linked `type: "transfer"` rows sharing a `transfer_id`, with client_ids
 * `"<base>:debit"` / `"<base>:credit"` — the same suffix convention the server RPC
 * uses, so the sync push can call apply_transfer() once per pair instead of twice
 * (spec: Transfers Between Accounts).
 */
export async function createLocalTransfer(input: TransferInput): Promise<{ debit: Transaction; credit: Transaction }> {
  if (!Number.isInteger(input.amountCentavos) || input.amountCentavos <= 0) {
    throw new Error("amountCentavos must be a positive integer");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("cannot transfer an account to itself");
  }

  const baseClientId = newClientId();
  const transferId = newClientId(); // local grouping id; server assigns its own transfer_id but we mirror one locally for the UI
  const occurredAt = input.occurredAt ?? new Date();

  const result = await database.write(async (writer) => {
    const fromAccount = await accounts().find(input.fromAccountId);
    const toAccount = await accounts().find(input.toAccountId);

    const debit = transactions().prepareCreate((t) => {
      t.accountId = input.fromAccountId;
      t.categoryId = null;
      t.type = "transfer";
      t.amountCentavos = input.amountCentavos;
      t.paymentMethod = null;
      t.note = input.note ?? null;
      t.occurredAt = occurredAt;
      t.transferId = transferId;
      t.reversesTransactionId = null;
      t.clientId = `${baseClientId}:debit`;
      t.pendingSyncStatus = "pending";
      t.serverId = null;
    });

    const credit = transactions().prepareCreate((t) => {
      t.accountId = input.toAccountId;
      t.categoryId = null;
      t.type = "transfer";
      t.amountCentavos = input.amountCentavos;
      t.paymentMethod = null;
      t.note = input.note ?? null;
      t.occurredAt = occurredAt;
      t.transferId = transferId;
      t.reversesTransactionId = null;
      t.clientId = `${baseClientId}:credit`;
      t.pendingSyncStatus = "pending";
      t.serverId = null;
    });

    const updatedFrom = fromAccount.prepareUpdate((a) => {
      a.balanceCentavos = a.balanceCentavos - input.amountCentavos;
    });
    const updatedTo = toAccount.prepareUpdate((a) => {
      a.balanceCentavos = a.balanceCentavos + input.amountCentavos;
    });

    await writer.batch(debit, credit, updatedFrom, updatedTo);
    return { debit, credit };
  });

  requestSync();
  return result;
}
