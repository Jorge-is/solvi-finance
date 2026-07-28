// Timezone-aware month-boundary math (spec: Timezone-Correct Timestamps).
//
// `occurred_at` is always stored/transmitted as UTC (timestamptz / epoch ms). For reports and
// budgets we must bucket movements by the CALENDAR month in the user's local timezone (default
// "America/Lima"), never in UTC — a movement at 23:30 local on the 31st must count as the 31st,
// not the next UTC day.
//
// NOTE: this file is intentionally duplicated (not imported) in
// supabase/functions/evaluate-budgets/index.ts — Edge Functions deploy independently of the
// mobile app and cannot share a module across the two build targets. Keep both in sync if the
// algorithm changes.

export type YearMonth = { year: number; month: number }; // month is 1-12

function offsetMillisAt(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) === 24 ? 0 : Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - instant.getTime();
}

/** Which local calendar year/month a UTC instant falls in, for a given IANA timezone. */
export function localYearMonth(instant: Date, timeZone: string): YearMonth {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { year: Number(map.year), month: Number(map.month) };
}

/** The UTC instant corresponding to local wall-clock `y-m-d h:mi:s` in `timeZone`. Two-pass DST-safe. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset1 = offsetMillisAt(new Date(guessUtc), timeZone);
  let utc = guessUtc - offset1;
  const offset2 = offsetMillisAt(new Date(utc), timeZone);
  if (offset2 !== offset1) {
    utc = guessUtc - offset2;
  }
  return new Date(utc);
}

/** [start, end) UTC instants bounding the given local calendar month. `end` is the first instant of the next month. */
export function monthBoundsUtc(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  const start = zonedTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = zonedTimeToUtc(nextYear, nextMonth, 1, 0, 0, 0, timeZone);
  return { start, end };
}

/** Month bounds for "the current local month" in `timeZone`, as of `now` (defaults to `new Date()`). */
export function currentMonthBoundsUtc(timeZone: string, now: Date = new Date()): { start: Date; end: Date } {
  const { year, month } = localYearMonth(now, timeZone);
  return monthBoundsUtc(year, month, timeZone);
}
