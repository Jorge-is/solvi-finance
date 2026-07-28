import { supabase } from "./supabase";

// Thin wrappers around Supabase Auth (spec: User Registration and Login).
// Deliberately return `{ error }` shaped results instead of throwing — screens
// decide how to render the error; we never leak "email exists / doesn't exist"
// detail from Supabase's own error messages beyond its generic message.

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { session: data.session ?? null, error };
}

export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { session: data.session ?? null, error };
}

/** Sends a magic link. The user completes login by following the emailed link (deep link handling is Phase 3 wiring). */
export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return { error };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getStoredSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}
