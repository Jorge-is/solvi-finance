import { Model } from "@nozbe/watermelondb";
import { text, readonly, date } from "@nozbe/watermelondb/decorators";

export type CategoryKind = "income" | "expense";

export default class Category extends Model {
  static table = "categories";

  @text("server_id") serverId!: string | null;
  @text("name") name!: string;
  @text("kind") kind!: CategoryKind;
  @readonly @date("created_at") createdAt!: Date;
  @readonly @date("updated_at") updatedAt!: Date;
}
