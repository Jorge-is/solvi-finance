import { Q } from "@nozbe/watermelondb";

import { database } from "../db";
import Account, { AccountType } from "../db/models/Account";

const accounts = () => database.get<Account>("accounts");

export function observeAccounts() {
  return accounts().query(Q.sortBy("created_at", Q.desc)).observe();
}

export async function listAccounts(): Promise<Account[]> {
  return accounts().query().fetch();
}

/**
 * Create an account locally. `startingBalanceCentavos` seeds the local cache only —
 * per spec (Account Creation), a brand-new account with no movements simply starts
 * at that balance; there is no RPC call needed since there's no movement to record.
 * Renaming/changing type is allowed to sync as a plain field update (accounts.balance
 * itself is never touched here — see spec: Direct balance write rejected).
 */
export async function createAccount(params: {
  name: string;
  type: AccountType;
  startingBalanceCentavos: number;
}): Promise<Account> {
  if (!Number.isInteger(params.startingBalanceCentavos)) {
    throw new Error("startingBalanceCentavos must be an integer (centavos)");
  }
  return database.write(async () => {
    return accounts().create((a) => {
      a.name = params.name;
      a.type = params.type;
      a.balanceCentavos = params.startingBalanceCentavos;
    });
  });
}

export async function renameAccount(account: Account, name: string, type: AccountType): Promise<void> {
  await database.write(async () => {
    await account.update((a) => {
      a.name = name;
      a.type = type;
    });
  });
}

export async function deleteAccount(account: Account): Promise<void> {
  await database.write(async () => {
    await account.markAsDeleted();
  });
}

export async function totalBalanceCentavos(): Promise<number> {
  const all = await listAccounts();
  return all.reduce((sum, a) => sum + a.balanceCentavos, 0);
}
