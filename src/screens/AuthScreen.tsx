import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { isFirebaseConfigured } from "../lib/firebase";
import { loginWithEmail, registerWithEmail } from "../services/auth";
import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

export function AuthScreen({
  styles,
  theme,
}: {
  styles: AppStyles;
  theme: ThemePalette;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [firstName, setFirstName] = useState("");
  const [nickname, setNickname] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!isFirebaseConfigured()) {
      setError("Firebase config eksik. app.json ayarları tamamlanmalı.");
      return;
    }

    if (
      !identifier.trim() ||
      !password.trim() ||
      (mode === "register" && (!firstName.trim() || !nickname.trim()))
    ) {
      setError("Tüm zorunlu alanları doldur.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "login") {
        await loginWithEmail(identifier.trim(), password);
      } else {
        await registerWithEmail(
          identifier.trim(),
          password,
          firstName.trim(),
          nickname.trim(),
        );
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Giriş sırasında bir hata oluştu.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
    >
      <ScrollView
        contentContainerStyle={[styles.authShell, { flexGrow: 1, flex: undefined }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <LinearGradient
          colors={[theme.hero, theme.heroSecondary, theme.accentStrong]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.authHero}
        >
          <Text style={styles.authHeroEyebrow}>Football Fantasy</Text>
          <Text style={styles.authHeroTitle}>Arkadaş ligin için giriş yap</Text>
          <Text style={styles.authHeroCopy}>
            Tahminlerini kaydetmek, lig oluşturmak ve puan tablona ulaşmak için
            hesabını aç.
          </Text>
        </LinearGradient>

        <View style={styles.authCard}>
          <View style={styles.authModeRow}>
            <Pressable
              onPress={() => setMode("login")}
              style={[
                styles.authModeButton,
                mode === "login" && styles.authModeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.authModeText,
                  mode === "login" && styles.authModeTextActive,
                ]}
              >
                Giriş Yap
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("register")}
              style={[
                styles.authModeButton,
                mode === "register" && styles.authModeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.authModeText,
                  mode === "register" && styles.authModeTextActive,
                ]}
              >
                Kayıt Ol
              </Text>
            </Pressable>
          </View>

          {mode === "register" ? (
            <>
              <View style={styles.authFieldWrap}>
                <Text style={styles.authLabel}>İsim</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Nida"
                  placeholderTextColor={theme.muted}
                  style={styles.authInput}
                />
              </View>

              <View style={styles.authFieldWrap}>
                <Text style={styles.authLabel}>Nickname</Text>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="kullaniciadi"
                  placeholderTextColor={theme.muted}
                  autoCapitalize="none"
                  style={styles.authInput}
                />
              </View>
            </>
          ) : null}

          <View style={styles.authFieldWrap}>
            <Text style={styles.authLabel}>
              {mode === "login" ? "E-posta veya nickname" : "E-posta"}
            </Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={
                mode === "login" ? "e-posta veya kullaniciadi" : "ornek@mail.com"
              }
              placeholderTextColor={theme.muted}
              autoCapitalize="none"
              keyboardType={mode === "login" ? "default" : "email-address"}
              style={styles.authInput}
            />
          </View>

          <View style={styles.authFieldWrap}>
            <Text style={styles.authLabel}>Şifre</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={theme.muted}
              secureTextEntry
              style={styles.authInput}
            />
          </View>

          {error ? <Text style={styles.authError}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={styles.authSubmitButton}
          >
            {submitting ? (
              <ActivityIndicator color={theme.heroText} />
            ) : (
              <Text style={styles.authSubmitText}>
                {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
