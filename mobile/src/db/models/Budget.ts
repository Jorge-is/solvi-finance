import { Model } from "@nozbe/watermelondb";
import { field, text, readonly, date } from "@nozbe/watermelondb/decorators";

export default class Budget extends Model {
  static table = "budgets";

  @text("server_id") serverId!: string | null;
  @text("category_id") categoryId!: string;
  // First day of the month, in the user's local timezone, stored as epoch ms.
  @date("month") month!: Date;
  @field("limit_centavos") limitCentavos!: number;
  @field("alert_80_sent") alert80Sent!: boolean;
  @field("alert_100_sent") alert100Sent!: boolean;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
