// supabase/functions/evaluate-budgets/index.ts
//
// Scheduled Edge Function (task 2.9). For every user, computes spent-vs-limit per
// budgeted category for the user's CURRENT LOCAL MONTH (using their `profiles.timezone`,
// default "America/Lima" — never UTC, spec: Timezone-Correct Timestamps applied to
// budgets too) and sends an Expo push notification at the 80% and 100% thresholds,
// exactly once each per budget/month — enforced via the `alert_80_sent`/`alert_100_sent`
// columns on `budgets` (spec: Approaching-Limit Alert, Limit-Exceeded Alert).
//
// Runs with the SERVICE ROLE key (bypasses RLS) because it must read across ALL users —
// this is the one place in the system that's allowed to do that, and it never accepts
// a caller-supplied user id; it always iterates every profile itself.
//
// Scheduling: NOT configured by this file — Edge Functions don't self-schedule. Deploy
// with `supabase functions deploy evaluate-budgets`, then either:
//   (a) Supabase Dashboard -> Edge Functions -> evaluate-budgets -> Schedule (cron), or
//   (b) `select cron.schedule('evaluate-budgets-hourly', '0 * * * *', $$ ... net.http_post ... $$)`
//       via pg_cron + pg_net, once a real project exists (needs the project's own URL).
// Hourly is a reasonable default cadence for near-real-time alerts without spamming.
//
// NOTE: the timezone math below is intentionally duplicated from
// mobile/src/lib/timezone.ts — Edge Functions deploy independently and can't import
// from the mobile app's build. Keep both in sync if the algorithm changes.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

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

function localYearMonth(instant: Date, timeZone: string): { year: number; month: number } {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" });
  const parts = dtf.formatToParts(instant);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { year: Number(map.year), month: Number(map.month) };
}

function zonedTimeToUtc(
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
  if (offset2 !== offset1) utc = guessUtc - offset2;
  return new Date(utc);
}

function monthBoundsUtc(year: number, month: number, timeZone: string): { start: Date; end: Date } {
  const start = zonedTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = zonedTimeToUtc(nextYear, nextMonth, 1, 0, 0, 0, timeZone);
  return { start, end };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({ to, title, body, sound: "default" }));
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(messages),
  }).catch((err) => {
    // Push delivery failures are logged, not thrown — a notification failure must never
    // block flipping alert_80_sent/alert_100_sent, or every future run would re-try
    // forever for a permanently-dead token. (Acceptable MVP tradeoff — see report.)
    console.error("[evaluate-budgets] Expo push send failed", err);
  });
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, timezone");
  if (profilesError) {
    return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
  }

  let evaluated = 0;
  let alertsSent = 0;

  for (const profile of profiles ?? []) {
    const timezone = profile.timezone || "America/Lima";
    const { year, month } = localYearMonth(new Date(), timezone);
    const { start, end } = monthBoundsUtc(year, month, timezone);
    const monthDateStr = `${year}-${pad2(month)}-01`;

    const { data: budgets, error: budgetsError } = await supabase
      .from("budgets")
      .select("id, category_id, limit_centavos, alert_80_sent, alert_100_sent")
      .eq("user_id", profile.id)
      .eq("month", monthDateStr);
    if (budgetsError || !budgets || budgets.length === 0) continue;

    const { data: tokenRows } = await supabase
      .from("push_tokens")
      .select("expo_push_token")
      .eq("user_id", profile.id);
    const tokens = (tokenRows ?? []).map((r: any) => r.expo_push_token);

    for (const budget of budgets) {
      evaluated += 1;
      if (budget.alert_100_sent) continue; // fully done for this budget/month already

      const { data: expenseRows, error: expenseError } = await supabase
        .from("transactions")
        .select("amount_centavos")
        .eq("user_id", profile.id)
        .eq("category_id", budget.category_id)
        .eq("type", "expense")
        .gte("occurred_at", start.toISOString())
        .lt("occurred_at", end.toISOString());
      if (expenseError) continue;

      const spent = (expenseRows ?? []).reduce((sum: number, r: any) => sum + r.amount_centavos, 0);
      const limit = budget.limit_centavos as number;
      if (limit <= 0) continue;

      if (spent >= limit && !budget.alert_100_sent) {
        await sendExpoPush(tokens, "Presupuesto superado", "Ya superaste el límite de tu presupuesto este mes.");
        await supabase
          .from("budgets")
          .update({ alert_100_sent: true, alert_80_sent: true })
          .eq("id", budget.id);
        alertsSent += 1;
      } else if (spent * 10 >= limit * 8 && !budget.alert_80_sent) {
        // spent/limit >= 0.8, computed with integer math (spent*10 >= limit*8) to avoid float.
        await sendExpoPush(tokens, "Presupuesto casi al límite", "Llegaste al 80% de tu presupuesto este mes.");
        await supabase.from("budgets").update({ alert_80_sent: true }).eq("id", budget.id);
        alertsSent += 1;
      }
    }
  }

  return new Response(JSON.stringify({ evaluated, alertsSent }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
