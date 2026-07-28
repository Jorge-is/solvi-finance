import { Q } from "@nozbe/watermelondb";

import { database } from "../db";
import Transaction from "../db/models/Transaction";
import Category from "../db/models/Category";
import { monthBoundsUtc } from "../lib/timezone";

const transactions = () => database.get<Transaction>("transactions");
const categories = () => database.get<Category>("categories");

export type CashFlowReport = {
  incomeCentavos: number;
  expenseCentavos: number;
  netCentavos: number;
};

export type CategoryBreakdownRow = {
  categoryId: string | null;
  categoryName: string;
  totalCentavos: number;
};

async function movementsInMonth(year: number, month: number, timezone: string): Promise<Transaction[]> {
  const { start, end } = monthBoundsUtc(year, month, timezone);
  return transactions()
    .query(
      Q.where("occurred_at", Q.gte(start.getTime())),
      Q.where("occurred_at", Q.lt(end.getTime()))
    )
    .fetch();
}

/**
 * Monthly cash flow (spec: Monthly Cash Flow Report). Transfers are excluded from both
 * totals (spec: Transfers Excluded from Reports) — only `income`/`expense` rows count.
 * Returns zeros for a month with no movements rather than erroring.
 */
export async function monthlyCashFlow(year: number, month: number, timezone: string): Promise<CashFlowReport> {
  const rows = await movementsInMonth(year, month, timezone);
  let incomeCentavos = 0;
  let expenseCentavos = 0;
  for (const t of rows) {
    if (t.type === "income") incomeCentavos += t.amountCentavos;
    else if (t.type === "expense") expenseCentavos += t.amountCentavos;
    // type === "transfer": intentionally excluded
  }
  return { incomeCentavos, expenseCentavos, netCentavos: incomeCentavos - expenseCentavos };
}

/**
 * Spending grouped by category for a month, sorted descending by amount
 * (spec: Spending by Category Report). Only `expense` rows count; transfers excluded.
 */
export async function categoryBreakdown(year: number, month: number, timezone: string): Promise<CategoryBreakdownRow[]> {
  const rows = await movementsInMonth(year, month, timezone);
  const totals = new Map<string, number>();
  for (const t of rows) {
    if (t.type !== "expense") continue;
    const key = t.categoryId ?? "__uncategorized__";
    totals.set(key, (totals.get(key) ?? 0) + t.amountCentavos);
  }

  const allCategories = await categories().query().fetch();
  const nameById = new Map(allCategories.map((c) => [c.id, c.name]));

  const result: CategoryBreakdownRow[] = Array.from(totals.entries()).map(([categoryId, totalCentavos]) => ({
    categoryId: categoryId === "__uncategorized__" ? null : categoryId,
    categoryName: categoryId === "__uncategorized__" ? "Sin categoría" : nameById.get(categoryId) ?? "Sin categoría",
    totalCentavos,
  }));

  result.sort((a, b) => b.totalCentavos - a.totalCentavos);
  return result;
}
