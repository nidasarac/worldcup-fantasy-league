import { MaterialCommunityIcons } from "@expo/vector-icons";
import { User } from "firebase/auth";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createLeagueForUser,
  joinLeagueWithInviteCode,
} from "../services/leagues";
import { AppStyles } from "../styles";
import { AppUser, League } from "../types/firestore";
import { ThemePalette } from "../theme";

export function ProfileScreen({
  styles,
  user,
  profile,
  onRefreshProfile,
  theme,
  userLeagues,
  userLeaguesLoading,
  userLeaguesError,
  onSetActiveLeague,
  activeLeagueName,
  onOpenPredictionHistory,
}: {
  styles: AppStyles;
  user: User;
  profile: AppUser | null;
  onRefreshProfile: () => void;
  theme: ThemePalette;
  userLeagues: Array<League & { id: string }>;
  userLeaguesLoading: boolean;
  userLeaguesError: string | null;
  onSetActiveLeague: (leagueId: string) => Promise<void>;
  activeLeagueName?: string | null;
  onOpenPredictionHistory: () => void;
}) {
  const [leagueMode, setLeagueMode] = useState<"create" | "join">("create");
  const [leagueName, setLeagueName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [leagueMessage, setLeagueMessage] = useState<string | null>(null);
  const [leagueError, setLeagueError] = useState<string | null>(null);
  const [submittingLeague, setSubmittingLeague] = useState(false);
  const [switchingLeagueId, setSwitchingLeagueId] = useState<string | null>(null);

  const nickname = profile?.nickname || user.displayName || "oyuncu";
  const firstName =
    profile?.firstName ||
    profile?.displayName ||
    user.displayName ||
    "World Cup 26 oyuncusu";
  const effectiveProfile =
    profile ??
    ({
      firstName,
      nickname,
      displayName: nickname,
      email: user.email || "",
      photoURL: "",
      activeLeagueId: "",
    } as AppUser);
  const initials = (nickname || user.email || "WC")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const activeLeagueEntry = userLeagues.find(
    (league) => league.id === effectiveProfile.activeLeagueId,
  );
  const currentActiveLeagueName =
    activeLeagueName || activeLeagueEntry?.name || null;

  const handleLeagueSubmit = async () => {
    if (leagueMode === "create" && !leagueName.trim()) {
      setLeagueError("Lig adı zorunlu.");
      return;
    }

    if (leagueMode === "join" && !inviteCode.trim()) {
      setLeagueError("Davet kodu zorunlu.");
      return;
    }

    setSubmittingLeague(true);
    setLeagueError(null);
    setLeagueMessage(null);

    try {
      if (leagueMode === "create") {
        const createdLeague = await createLeagueForUser({
          ownerId: user.uid,
          ownerProfile: effectiveProfile,
          leagueName: leagueName.trim(),
        });

        setLeagueMessage(
          `Lig oluşturuldu. Kodun: ${createdLeague.inviteCode}`,
        );
        setLeagueName("");
      } else {
        const joinedLeague = await joinLeagueWithInviteCode({
          userId: user.uid,
          userProfile: effectiveProfile,
          inviteCode: inviteCode.trim(),
        });

        setLeagueMessage(`${joinedLeague.leagueName} ligine katıldın.`);
        setInviteCode("");
      }

      onRefreshProfile();
    } catch (error) {
      setLeagueError(
        error instanceof Error ? error.message : "Lig işlemi tamamlanamadı.",
      );
    } finally {
      setSubmittingLeague(false);
    }
  };

  const handleSetLeague = async (leagueId: string) => {
    setSwitchingLeagueId(leagueId);
    setLeagueError(null);
    setLeagueMessage(null);

    try {
      await onSetActiveLeague(leagueId);
      const selectedLeague = userLeagues.find((item) => item.id === leagueId);
      setLeagueMessage(
        selectedLeague
          ? `${selectedLeague.name} artık aktif ligin.`
          : "Aktif lig güncellendi.",
      );
    } catch (error) {
      setLeagueError(
        error instanceof Error ? error.message : "Aktif lig güncellenemedi.",
      );
    } finally {
      setSwitchingLeagueId(null);
    }
  };

  return (
    <View style={styles.profileContent}>
      <View style={styles.profileHero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.profileName}>{firstName}</Text>
        <Text style={styles.profileHandle}>
          @{nickname} • {user.email || "oyuncu@mail.com"}
        </Text>
        {effectiveProfile.activeLeagueId ? (
          <View style={styles.activeLeagueChip}>
            <Text style={styles.activeLeagueChipText}>
              Aktif Lig • {currentActiveLeagueName || "Lig yükleniyor"}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Lig Yönetimi</Text>
        <Text style={styles.settingsCopy}>
          Kendi liginizi kurabilir veya davet koduyla mevcut bir lige
          katılabilirsiniz.
        </Text>

        <View style={styles.authModeRow}>
          <Pressable
            onPress={() => setLeagueMode("create")}
            style={[
              styles.authModeButton,
              leagueMode === "create" && styles.authModeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.authModeText,
                leagueMode === "create" && styles.authModeTextActive,
              ]}
            >
              Lig Oluştur
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setLeagueMode("join")}
            style={[
              styles.authModeButton,
              leagueMode === "join" && styles.authModeButtonActive,
            ]}
          >
            <Text
              style={[
                styles.authModeText,
                leagueMode === "join" && styles.authModeTextActive,
              ]}
            >
              Lige Katıl
            </Text>
          </Pressable>
        </View>

        {leagueMode === "create" ? (
          <View style={styles.authFieldWrap}>
            <Text style={styles.authLabel}>Lig Adı</Text>
            <TextInput
              value={leagueName}
              onChangeText={setLeagueName}
              placeholder="Nida'nın Dünya Kupası Ligi"
              placeholderTextColor={theme.muted}
              style={styles.authInput}
            />
          </View>
        ) : (
          <View style={styles.authFieldWrap}>
            <Text style={styles.authLabel}>Davet Kodu</Text>
            <TextInput
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="TR1923"
              placeholderTextColor={theme.muted}
              autoCapitalize="characters"
              style={styles.authInput}
            />
          </View>
        )}

        {leagueError ? <Text style={styles.authError}>{leagueError}</Text> : null}
        {leagueMessage ? (
          <Text style={styles.leagueSuccess}>{leagueMessage}</Text>
        ) : null}

        <Pressable
          onPress={handleLeagueSubmit}
          disabled={submittingLeague || Boolean(switchingLeagueId)}
          style={styles.authSubmitButton}
        >
          {submittingLeague ? (
            <ActivityIndicator color={theme.heroText} />
          ) : (
            <Text style={styles.authSubmitText}>
              {leagueMode === "create" ? "Ligi Kur" : "Koda Katıl"}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Liglerim</Text>
        <Text style={styles.settingsCopy}>
          Birden fazla lige katılabilirsin. Buradan tek bir ligi aktif seçip
          sıralamayı o lige göre takip edersin. Lig değiştirmek için aşağıdaki
          kartlarda "Aktif Yap" butonunu kullan.
        </Text>

        {userLeaguesLoading ? (
          <Text style={styles.loadingCopy}>Liglerin yükleniyor.</Text>
        ) : null}

        {userLeaguesError ? (
          <Text style={styles.authError}>{userLeaguesError}</Text>
        ) : null}

        {!userLeaguesLoading && !userLeaguesError && userLeagues.length === 0 ? (
          <Text style={styles.loadingCopy}>
            Henüz bir lige dahil değilsin. Yukarıdan yeni lig kurabilir ya da
            davet koduyla katılabilirsin.
          </Text>
        ) : null}

        {userLeagues.map((league) => {
          const isActive = league.id === effectiveProfile.activeLeagueId;

          return (
            <View key={league.id} style={styles.userLeagueCard}>
              <View style={styles.userLeagueBody}>
                <Text style={styles.userLeagueName}>{league.name}</Text>
                <Text style={styles.userLeagueMeta}>
                  Kod: {league.inviteCode} • {league.memberCount} üye
                </Text>
              </View>

              {isActive ? (
                <View style={styles.userLeagueActiveBadge}>
                  <Text style={styles.userLeagueActiveText}>Aktif</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleSetLeague(league.id)}
                  disabled={switchingLeagueId === league.id}
                  style={styles.userLeagueAction}
                >
                  {switchingLeagueId === league.id ? (
                    <ActivityIndicator color={theme.heroText} />
                  ) : (
                    <Text style={styles.userLeagueActionText}>Aktif Yap</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Geçmiş Tahminlerim</Text>
        <Text style={styles.settingsCopy}>
          Sonuçlanan maçlardaki tahminlerini tek ekrandan açıp detaylı olarak inceleyebilirsin.
        </Text>

        <Pressable
          onPress={onOpenPredictionHistory}
          style={styles.settingsPrimaryAction}
        >
          <MaterialCommunityIcons
            name="history"
            size={18}
            color={theme.heroText}
          />
          <Text style={styles.settingsPrimaryActionText}>
            Geçmiş Tahminlerim
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
