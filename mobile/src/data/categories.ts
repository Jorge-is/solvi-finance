import { Q } from "@nozbe/watermelondb";

import { database } from "../db";
import Category, { CategoryKind } from "../db/models/Category";
import { requestSync } from "../sync";

const categories = () => database.get<Category>("categories");

export function observeCategories() {
  return categories().query(Q.sortBy("name", Q.asc)).observe();
}

export async function listCategories(): Promise<Category[]> {
  return categories().query().fetch();
}

export async function createCategory(name: string, kind: CategoryKind): Promise<Category> {
  const category = await database.write(async () => {
    return categories().create((c) => {
      c.name = name;
      c.kind = kind;
      c.serverId = null;
    });
  });
  requestSync();
  return category;
}
