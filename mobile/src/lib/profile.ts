import { supabase } from "./supabase";

// `profiles` is not mirrored locally (single row per user, managed by Supabase Auth —
// see the comment in src/db/schema.ts), so we fetch `timezone` directly from the server
// and cache it in memory for the session. Falls back to the same default the Postgres
// column uses if the fetch fails (e.g. offline on first launch before any pull has happened).
const DEFAULT_TIMEZONE = "America/Lima";

let cachedTimezone: string | null = null;

export async function getUserTimezone(): Promise<string> {
  if (cachedTimezone) return cachedTimezone;
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return DEFAULT_TIMEZONE;

    const { data, error } = await supabase.from("profiles").select("timezone").eq("id", userId).single();
    if (error || !data?.timezone) return DEFAULT_TIMEZONE;

    cachedTimezone = data.timezone as string;
    return cachedTimezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
