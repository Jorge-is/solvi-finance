import { Q } from "@nozbe/watermelondb";

import { database } from "../db";
import Budget from "../db/models/Budget";
import Transaction from "../db/models/Transaction";
import { requestSync } from "../sync";
import { currentMonthBoundsUtc } from "../lib/timezone";

const budgets = () => database.get<Budget>("budgets");
const transactions = () => database.get<Transaction>("transactions");

export function observeBudgetsForMonth(monthStartMs: number) {
  return budgets().query(Q.where("month", monthStartMs)).observe();
}

export async function createBudget(params: {
  categoryId: string;
  month: Date; // first day of month, local
  limitCentavos: number;
}): Promise<Budget> {
  if (!Number.isInteger(params.limitCentavos) || params.limitCentavos <= 0) {
    throw new Error("limitCentavos must be a positive integer");
  }
  const budget = await database.write(async () => {
    return budgets().create((b) => {
      b.categoryId = params.categoryId;
      b.month = params.month;
      b.limitCentavos = params.limitCentavos;
      b.alert80Sent = false;
      b.alert100Sent = false;
      b.serverId = null;
    });
  });
  requestSync();
  return budget;
}

export async function updateBudgetLimit(budget: Budget, limitCentavos: number): Promise<void> {
  if (!Number.isInteger(limitCentavos) || limitCentavos <= 0) {
    throw new Error("limitCentavos must be a positive integer");
  }
  await database.write(async () => {
    await budget.update((b) => {
      b.limitCentavos = limitCentavos;
    });
  });
  requestSync();
}

export async function deleteBudget(budget: Budget): Promise<void> {
  await database.write(async () => {
    await budget.markAsDeleted();
  });
  requestSync();
}

/**
 * Spent amount for a category in the given local-timezone month (spec: Budget Evaluation
 * Against Spending). Computed from local WatermelonDB data — the same data the quick-entry
 * form just wrote — so the UI reflects budget usage instantly without a round trip.
 * Excludes transfers (spec: Transfers Excluded from Reports, same rule applies to budgets).
 */
export async function spentForCategoryInMonth(
  categoryId: string,
  timezone: string,
  monthDate: Date = new Date()
): Promise<number> {
  const { start, end } = currentMonthBoundsUtc(timezone, monthDate);
  const rows = await transactions()
    .query(
      Q.where("category_id", categoryId),
      Q.where("type", "expense"),
      Q.where("occurred_at", Q.gte(start.getTime())),
      Q.where("occurred_at", Q.lt(end.getTime()))
    )
    .fetch();
  return rows.reduce((sum, t) => sum + t.amountCentavos, 0);
}
