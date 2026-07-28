import * as Crypto from "expo-crypto";

/** Client-generated idempotency key for offline-created rows (spec: Offline Creation). */
export function newClientId(): string {
  return Crypto.randomUUID();
}
