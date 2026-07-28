import { Model } from "@nozbe/watermelondb";
import { field, text, readonly, date } from "@nozbe/watermelondb/decorators";

export type TransactionType = "income" | "expense" | "transfer";
export type PendingSyncStatus = "pending" | "synced" | "failed";

export default class Transaction extends Model {
  static table = "transactions";

  @text("server_id") serverId!: string | null;
  @text("account_id") accountId!: string;
  @text("category_id") categoryId!: string | null;
  @text("type") type!: TransactionType;
  // Centavos PEN, always positive; sign is derived from `type`. Never a float.
  @field("amount_centavos") amountCentavos!: number;
  @text("payment_method") paymentMethod!: string | null;
  @text("note") note!: string | null;
  @date("occurred_at") occurredAt!: Date;
  @text("transfer_id") transferId!: string | null;
  @text("reverses_transaction_id") reversesTransactionId!: string | null;
  // Idempotency key generated on-device; required for offline creation and sync
  // (spec: Offline Creation, Sync Without Duplication).
  @text("client_id") clientId!: string;
  @text("sync_status") pendingSyncStatus!: PendingSyncStatus;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
