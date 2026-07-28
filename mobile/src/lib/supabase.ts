import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

// Adapts expo-secure-store (Keychain on iOS / Keystore on Android) to the
// {getItem,setItem,removeItem} interface supabase-js expects for session
// persistence. We deliberately do NOT use plain AsyncStorage here — the
// session (access + refresh token) must never sit in unencrypted storage
// (spec: Session Storage — "MUST be stored in the device's secure storage").
//
// Known limitation: SecureStore enforces a ~2048 byte value size on some
// platforms. A Supabase session (access_token + refresh_token + user data)
// can approach or exceed that. If sessions start silently failing to
// persist, the fix is the "large secure store" pattern (encrypt the session
// with a random AES key, store the blob in AsyncStorage and only the small
// key in SecureStore) — not a fallback to plaintext AsyncStorage.
const secureStoreAdapter: SupportedStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy mobile/.env.example to mobile/.env and fill in your Supabase project values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL-based OAuth redirect flow like the web SDK.
    detectSessionInUrl: false,
  },
});
