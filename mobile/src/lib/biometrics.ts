import * as LocalAuthentication from "expo-local-authentication";

// spec: Local Biometric Lock — "MUST fall back to requiring standard login credentials"
// when biometrics are unavailable or fail. Never treat unavailability as a hard lockout.

export async function isBiometricUnlockAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
}

export type BiometricResult = "success" | "unavailable" | "failed" | "cancelled";

export async function unlockWithBiometrics(): Promise<BiometricResult> {
  const available = await isBiometricUnlockAvailable();
  if (!available) return "unavailable";

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Desbloquea Finanzas",
    cancelLabel: "Usar contraseña",
    disableDeviceFallback: false,
  });

  if (result.success) return "success";
  if (result.error === "user_cancel" || result.error === "system_cancel") return "cancelled";
  return "failed";
}
