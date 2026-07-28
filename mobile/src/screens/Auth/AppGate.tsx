import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { getStoredSession } from "../../lib/auth";
import { unlockWithBiometrics } from "../../lib/biometrics";
import LoginScreen from "./LoginScreen";

type GateState = "checking" | "biometric-lock" | "login" | "unlocked";

export type AppGateProps = {
  /** Rendered once the user is authenticated AND (if applicable) has passed the biometric lock. */
  children: React.ReactNode;
};

/**
 * Entry gate combining spec: Session Storage ("restore session ... subject to biometric
 * unlock") and spec: Local Biometric Lock. Flow:
 *  1. No stored session -> LoginScreen.
 *  2. Stored session + biometrics available -> prompt biometric; success unlocks.
 *  3. Stored session + biometrics unavailable/failed -> fall back to LoginScreen
 *     (spec: "MUST fall back to requiring standard login credentials").
 */
export default function AppGate({ children }: AppGateProps) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    checkSessionAndBiometrics();
  }, []);

  async function checkSessionAndBiometrics() {
    setState("checking");
    const session = await getStoredSession();
    if (!session) {
      setState("login");
      return;
    }
    setState("biometric-lock");
    await attemptBiometricUnlock();
  }

  async function attemptBiometricUnlock() {
    const result = await unlockWithBiometrics();
    if (result === "success") {
      setState("unlocked");
    } else if (result === "unavailable") {
      // No biometrics enrolled/available on this device — a session still exists, but
      // per spec we fall back to standard login rather than silently granting access.
      setState("login");
    } else {
      // "failed" or "cancelled"
      setState("biometric-lock");
    }
  }

  if (state === "checking") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state === "login") {
    return <LoginScreen onLoggedIn={() => setState("unlocked")} />;
  }

  if (state === "biometric-lock") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Finanzas bloqueada</Text>
        <TouchableOpacity style={styles.button} onPress={attemptBiometricUnlock}>
          <Text style={styles.buttonText}>Desbloquear</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setState("login")}>
          <Text style={styles.switchMode}>Usar contraseña en su lugar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  button: { backgroundColor: "#111827", borderRadius: 8, paddingVertical: 14, paddingHorizontal: 32 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  switchMode: { color: "#2563eb", marginTop: 8 },
});
