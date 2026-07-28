import { Model } from "@nozbe/watermelondb";
import { field, text, readonly, date } from "@nozbe/watermelondb/decorators";

export type AccountType = "efectivo" | "banco" | "yape" | "plin";

export default class Account extends Model {
  static table = "accounts";

  @text("server_id") serverId!: string | null;
  @text("name") name!: string;
  @text("type") type!: AccountType;
  // Centavos PEN. Read-only cache of the server-materialized balance — never
  // write this directly; balance changes only via apply_transaction/apply_transfer.
  @field("balance_centavos") balanceCentavos!: number;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
