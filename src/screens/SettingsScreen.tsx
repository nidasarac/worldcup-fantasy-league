import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { WorldCupData } from "../api/worldCup";
import { AdminPanel } from "../components/AdminPanel";
import { logoutUser } from "../services/auth";
import { AppStyles } from "../styles";
import { ThemeMode, ThemePalette } from "../theme";

const ADMIN_EMAILS = ["nidasaracc@gmail.com", "nnidasarac@gmail.com"];

export function SettingsScreen({
  styles,
  theme,
  mode,
  onThemeChange,
  userEmail,
  worldCupData,
  onRefreshWorldCupData,
  onLeagueRefresh,
}: {
  styles: AppStyles;
  theme: ThemePalette;
  mode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  userEmail?: string;
  worldCupData?: WorldCupData | null;
  onRefreshWorldCupData: () => void;
  onLeagueRefresh: () => void;
}) {
  return (
    <>
      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Görünüm</Text>
        <Text style={styles.settingsCopy}>
          Uygulamanın tema görünümünü buradan değiştirebilirsin.
        </Text>

        <View style={styles.themeSwitchRow}>
          {(["dark", "light"] as ThemeMode[]).map((item) => {
            const active = item === mode;

            return (
              <Pressable
                key={item}
                onPress={() => onThemeChange(item)}
                style={[styles.themeOption, active && styles.themeOptionActive]}
              >
                <Text
                  style={[
                    styles.themeOptionText,
                    active && styles.themeOptionTextActive,
                  ]}
                >
                  {item === "dark" ? "Lacivert" : "Açık"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Bildirimler</Text>
        <Text style={styles.settingsCopy}>
          Tahmin penceresi kapanmadan 1 saat önce otomatik maç bildirimi alırsın.
          İzin vermişsen bildirimler arka planda da çalışır.
        </Text>
      </View>

      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Hesap ve Güvenlik</Text>
        <Text style={styles.settingsCopy}>
          E-posta, şifre ve hesap tercihleri gibi alanları bu ekranda
          genişleteceğiz.
        </Text>

        <Pressable onPress={() => logoutUser()} style={styles.settingsDangerAction}>
          <MaterialCommunityIcons name="logout" size={18} color="#ffffff" />
          <Text style={styles.settingsDangerActionText}>Çıkış yap</Text>
        </Pressable>
      </View>

      {userEmail && ADMIN_EMAILS.includes(userEmail) ? (
        <AdminPanel
          styles={styles}
          theme={theme}
          worldCupData={worldCupData ?? null}
          onRefreshWorldCupData={onRefreshWorldCupData}
          onLeagueRefresh={onLeagueRefresh}
        />
      ) : null}
    </>
  );
}
