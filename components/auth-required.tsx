import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

import { useColors } from "@/hooks/use-colors";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenContainer } from "@/components/screen-container";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";

export function AuthRequired({ title = "Sign in to continue", description = "Your account keeps your partner space private and synchronized." }: { title?: string; description?: string }) {
  const colors = useColors();
  const { signInWithEmail, signUpWithEmail, resetPassword } = useFirebaseAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setMessage("Use a password with at least six characters.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      if (mode === "signIn") {
        await signInWithEmail(normalizedEmail, password);
      } else {
        await signUpWithEmail(normalizedEmail, password);
      }
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code.includes("invalid-credential") || code.includes("wrong-password")) {
        setMessage("Email or password is incorrect.");
      } else if (code.includes("email-already-in-use")) {
        setMessage("An account already exists for this email. Sign in instead.");
      } else if (code.includes("weak-password")) {
        setMessage("Choose a stronger password with at least six characters.");
      } else {
        setMessage("Unable to continue. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const sendReset = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage("Enter your email first, then request a reset link.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setMessage("A password reset link has been sent to your email.");
    } catch {
      setMessage("Unable to send a reset link right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer className="flex-1 items-center justify-center px-8">
      <GlassSurface tone="strong" intensity={50} style={styles.card}>
        <Image source={require("../assets/images/partner-sync-brand.png")} resizeMode="contain" style={styles.brand} accessibilityLabel="Partner Sync" />
        <View style={styles.copy}>
          <Text className="text-center text-xl font-bold text-foreground">{title}</Text>
          <Text className="mt-3 text-center text-sm leading-5 text-muted">{description}</Text>
        </View>
        <TextInput
          accessibilityLabel="Email address"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={colors.muted}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          textContentType="emailAddress"
          value={email}
        />
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoComplete={mode === "signIn" ? "current-password" : "new-password"}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
          textContentType={mode === "signIn" ? "password" : "newPassword"}
          value={password}
        />
        {message ? <Text style={[styles.message, { color: colors.muted }]}>{message}</Text> : null}
        <Pressable onPress={submit} disabled={submitting} style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : pressed ? 0.84 : 1 }]}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={{ color: colors.background, fontWeight: "700" }}>{mode === "signIn" ? "Sign in securely" : "Create secure account"}</Text>}
        </Pressable>
        <View style={styles.links}>
          <Pressable disabled={submitting} onPress={() => { setMode(mode === "signIn" ? "signUp" : "signIn"); setMessage(null); }}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{mode === "signIn" ? "Create an account" : "I already have an account"}</Text>
          </Pressable>
          {mode === "signIn" ? <Pressable disabled={submitting} onPress={sendReset}><Text style={{ color: colors.primary, fontWeight: "700" }}>Reset password</Text></Pressable> : null}
        </View>
      </GlassSurface>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: { height: 132, width: "100%" },
  button: { alignItems: "center", borderRadius: 12, justifyContent: "center", marginTop: 16, minHeight: 48, paddingHorizontal: 22 },
  card: { maxWidth: 380, padding: 18, width: "100%" },
  copy: { paddingHorizontal: 10 },
  input: { borderRadius: 12, borderWidth: 1, fontSize: 16, marginTop: 12, minHeight: 48, paddingHorizontal: 14 },
  links: { alignItems: "center", gap: 14, marginTop: 18 },
  message: { fontSize: 13, lineHeight: 18, marginTop: 12, textAlign: "center" },
});
