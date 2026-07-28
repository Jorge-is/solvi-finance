import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { sendMagicLink, signInWithPassword } from "../../lib/auth";

type Mode = "password" | "magic-link";

export type LoginScreenProps = {
  /** Called after a successful password login with an active session. */
  onLoggedIn: () => void;
};

/**
 * spec: User Registration and Login — email/password or magic link via Supabase Auth.
 * On invalid credentials shows a generic error, never revealing whether the email exists.
 */
export default function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handlePasswordLogin() {
    setError(null);
    setLoading(true);
    const { session, error: signInError } = await signInWithPassword(email.trim(), password);
    setLoading(false);
    if (signInError || !session) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    onLoggedIn();
  }

  async function handleMagicLink() {
    setError(null);
    setLoading(true);
    const { error: magicLinkError } = await sendMagicLink(email.trim());
    setLoading(false);
    if (magicLinkError) {
      setError("No se pudo enviar el enlace. Intenta de nuevo.");
      return;
    }
    setMagicLinkSent(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finanzas</Text>

      <TextInput
        style={styles.input}
        placeholder="correo@ejemplo.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="login-email"
      />

      {mode === "password" && (
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="login-password"
        />
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      {magicLinkSent && <Text style={styles.info}>Revisa tu correo para el enlace de acceso.</Text>}

      {loading ? (
        <ActivityIndicator />
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={mode === "password" ? handlePasswordLogin : handleMagicLink}
        >
          <Text style={styles.buttonText}>{mode === "password" ? "Entrar" : "Enviar enlace mágico"}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => setMode(mode === "password" ? "magic-link" : "password")}>
        <Text style={styles.switchMode}>
          {mode === "password" ? "Usar enlace mágico en su lugar" : "Usar contraseña en su lugar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: "#111827", borderRadius: 8, padding: 14, alignItems: "center" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  error: { color: "#dc2626", fontSize: 14 },
  info: { color: "#059669", fontSize: 14 },
  switchMode: { textAlign: "center", color: "#2563eb", marginTop: 8 },
});
