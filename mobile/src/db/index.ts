import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";

import { schema } from "./schema";
import Account from "./models/Account";
import Category from "./models/Category";
import Transaction from "./models/Transaction";
import Budget from "./models/Budget";

const adapter = new SQLiteAdapter({
  schema,
  jsi: true, // use the JSI adapter on iOS/Android for better performance
  onSetUpError: (error) => {
    // Local DB failed to open — surface loudly, do not silently continue.
    console.error("[watermelondb] failed to set up local database", error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Account, Category, Transaction, Budget],
});
