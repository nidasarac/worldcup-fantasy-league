import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAutoSettle } from "./src/hooks/useAutoSettle";
import { useAuthSession } from "./src/hooks/useAuthSession";
import { scheduleMatchNotifications } from "./src/services/notifications";
import { useLeague } from "./src/hooks/useLeague";
import { useLeagueMembers } from "./src/hooks/useLeagueMembers";
import { useUserLeagues } from "./src/hooks/useUserLeagues";
import { useUserProfile } from "./src/hooks/useUserProfile";
import { AuthScreen } from "./src/screens/AuthScreen";
import { FixturesScreen } from "./src/screens/FixturesScreen";
import { useWorldCupData } from "./src/hooks/useWorldCupData";
import { HomeScreen } from "./src/screens/HomeScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";
import { PredictionHistoryScreen } from "./src/screens/PredictionHistoryScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { logoutUser } from "./src/services/auth";
import { leaveLeague, setActiveLeague } from "./src/services/leagues";
import { createStyles } from "./src/styles";
import { AppUser, League, LeagueMember } from "./src/types/firestore";
import { tabs, TabKey, ThemeMode, ThemePalette, themes } from "./src/theme";

function SplashScreen({
  styles,
  theme,
}: {
  styles: ReturnType<typeof createStyles>;
  theme: ThemePalette;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 820,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 820,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => pulse.stop();
  }, [opacity, scale]);

  return (
    <LinearGradient
      colors={[theme.hero, theme.heroSecondary, theme.accentStrong]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[styles.splashContainer, { opacity }]}>
        <Animated.View
          style={[styles.splashIconWrap, { transform: [{ scale }] }]}
        >
          <MaterialCommunityIcons
            name="trophy-variant"
            size={52}
            color={theme.heroText}
          />
        </Animated.View>
        <Text style={styles.splashTitle}>World Cup 26</Text>
        <Text style={styles.splashSubtitle}>
          Oturum kontrol ediliyor…
        </Text>
      </Animated.View>
    </LinearGradient>
  );
}

function AppHeader({
  activeTab,
  onProfileAction,
  profileView,
  styles,
  theme,
}: {
  activeTab: TabKey;
  onProfileAction: () => void;
  profileView: "profile" | "settings" | "history";
  styles: ReturnType<typeof createStyles>;
  theme: ThemePalette;
}) {
  const headerMap = {
    home: {
      eyebrow: "World Cup 26",
      title: "Günlük tahminler",
      subtitle: "Bugünün maçlarını aç ve hızlı tahmin yap.",
      icon: "soccer-field",
    },
    fixtures: {
      eyebrow: "Fikstür",
      title: "Maç takvimi",
      subtitle: "Gün, grup ve saat bazlı tüm maçları takip et.",
      icon: "calendar-star",
    },
    leaderboard: {
      eyebrow: "Arkadaş Ligi",
      title: "Lig sıralaması",
      subtitle: "Arkadaşlarınla puan yarışını buradan takip et.",
      icon: "podium",
    },
    profile: {
      eyebrow: "Oyuncu Profili",
      title:
        profileView === "settings"
          ? "Ayarlar"
          : profileView === "history"
            ? "Geçmiş Tahminler"
            : "Profil",
      subtitle:
        profileView === "settings"
          ? "Görünüm, bildirim ve hesap tercihlerini yönet."
          : profileView === "history"
            ? "Sonuçlanan maçları seçip tahmin detaylarını aç."
            : "Hesabın, ligin ve oyuncu kimliğin burada.",
      icon:
        profileView === "settings"
          ? "cog-outline"
          : profileView === "history"
            ? "history"
            : "account-star",
    },
  } as const;

  const current = headerMap[activeTab];

  return (
    <View style={styles.header}>
      <View style={styles.headerTextWrap}>
        <View style={styles.eyebrowRow}>
          <MaterialCommunityIcons
            name={current.icon}
            size={16}
            color={theme.accent}
          />
          <Text style={styles.eyebrow}>{current.eyebrow}</Text>
          <View style={styles.eyebrowDot} />
        </View>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>
      </View>

      {activeTab === "profile" ? (
        <Pressable onPress={onProfileAction} style={styles.settingsButton}>
          <MaterialCommunityIcons
            name={profileView === "profile" ? "tune-variant" : "close"}
            size={24}
            color={theme.ink}
          />
        </Pressable>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );
}

function TabContent({
  activeTab,
  styles,
  theme,
  mode,
  profileView,
  onThemeChange,
  data,
  loading,
  error,
  currentUserId,
  user,
  profile,
  onRefreshProfile,
  userLeagues,
  userLeaguesLoading,
  userLeaguesError,
  onSetActiveLeague,
  onOpenPredictionHistory,
  onLeaveLeague,
  activeLeagueName,
  activeLeagueId,
  leagueMembers,
  league,
  leaderboardLoading,
  leaderboardError,
  onRefreshWorldCupData,
}: {
  activeTab: TabKey;
  styles: ReturnType<typeof createStyles>;
  theme: ThemePalette;
  mode: ThemeMode;
  profileView: "profile" | "settings" | "history";
  onThemeChange: (mode: ThemeMode) => void;
  data: ReturnType<typeof useWorldCupData>["data"];
  loading: boolean;
  error: string | null;
  currentUserId: string;
  user: User;
  profile: AppUser | null;
  onRefreshProfile: () => void;
  userLeagues: Array<League & { id: string }>;
  userLeaguesLoading: boolean;
  userLeaguesError: string | null;
  onSetActiveLeague: (leagueId: string) => Promise<void>;
  onOpenPredictionHistory: () => void;
  onLeaveLeague: (leagueId: string) => Promise<void>;
  activeLeagueName?: string | null;
  activeLeagueId?: string;
  leagueMembers: Array<LeagueMember & { id: string }>;
  league: League | null;
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  onRefreshWorldCupData: () => void;
}) {
  const content = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <HomeScreen
            styles={styles}
            theme={theme}
            data={data}
            loading={loading}
            error={error}
            userId={currentUserId}
            activeLeagueId={activeLeagueId}
          />
        );
      case "fixtures":
        return (
          <FixturesScreen
            styles={styles}
            theme={theme}
            data={data}
            loading={loading}
            error={error}
          />
        );
      case "leaderboard":
        return (
          <LeaderboardScreen
            styles={styles}
            theme={theme}
            data={data}
            loading={leaderboardLoading}
            error={leaderboardError}
            leagueMembers={leagueMembers}
            league={league}
            currentUserId={currentUserId}
            onLeaveLeague={onLeaveLeague}
            activeLeagueId={activeLeagueId}
          />
        );
      case "profile":
        return profileView === "settings" ? (
          <SettingsScreen
            styles={styles}
            theme={theme}
            mode={mode}
            onThemeChange={onThemeChange}
            userEmail={user?.email ?? ""}
            worldCupData={data}
            onRefreshWorldCupData={onRefreshWorldCupData}
          />
        ) : profileView === "history" ? (
          <PredictionHistoryScreen
            styles={styles}
            theme={theme}
            user={user}
            worldCupData={data}
          />
        ) : (
          <ProfileScreen
            styles={styles}
            user={user}
            profile={profile}
            onRefreshProfile={onRefreshProfile}
            theme={theme}
            userLeagues={userLeagues}
            userLeaguesLoading={userLeaguesLoading}
            userLeaguesError={userLeaguesError}
            onSetActiveLeague={onSetActiveLeague}
            activeLeagueName={league?.name}
            onOpenPredictionHistory={onOpenPredictionHistory}
          />
        );
    }
  }, [
    activeTab,
    data,
    error,
    currentUserId,
    profileView,
    loading,
    mode,
    onThemeChange,
    styles,
    theme,
    user,
    profile,
    onRefreshProfile,
    userLeagues,
    userLeaguesLoading,
    userLeaguesError,
    onSetActiveLeague,
    onOpenPredictionHistory,
    onLeaveLeague,
    currentUserId,
    activeLeagueName,
    activeLeagueId,
    leagueMembers,
    league,
    leaderboardLoading,
    leaderboardError,
    onRefreshWorldCupData,
  ]);

  return <>{content}</>;
}

function BottomNav({
  activeTab,
  onChange,
  styles,
  theme,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
  styles: ReturnType<typeof createStyles>;
  theme: ThemePalette;
}) {
  return (
    <View style={styles.bottomNavShell}>
      <LinearGradient
        colors={theme.navGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bottomNav}
      >
        <View style={styles.bottomNavGlow} />
        {tabs.map((tab) => {
          const active = tab.key === activeTab;

          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={styles.navItem}
            >
              {active ? (
                <LinearGradient
                  colors={theme.navActiveGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.navItemActive}
                >
                  <View style={styles.navIconWrap}>
                    <MaterialCommunityIcons
                      name={tab.icon as never}
                      size={20}
                      color={theme.navActiveText}
                    />
                  </View>
                  <Text style={[styles.navLabel, styles.navLabelActive]}>
                    {tab.label}
                  </Text>
                </LinearGradient>
              ) : (
                <>
                  <View style={styles.navIconWrap}>
                    <MaterialCommunityIcons
                      name={tab.icon as never}
                      size={20}
                      color={theme.navIdleIcon}
                    />
                  </View>
                  <Text style={styles.navLabel}>{tab.label}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
}

const SPLASH_MIN_MS = 2500;

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [profileView, setProfileView] = useState<
    "profile" | "settings" | "history"
  >("profile");
  const [loggingOut, setLoggingOut] = useState(false);
  const [leagueRefreshKey, setLeagueRefreshKey] = useState(0);
  const [splashDone, setSplashDone] = useState(false);
  const authSession = useAuthSession();

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);
  const userProfile = useUserProfile(authSession.user?.uid);
  const activeLeague = useLeague(
    userProfile.profile?.activeLeagueId,
    leagueRefreshKey,
  );
  const leagueMembers = useLeagueMembers(
    userProfile.profile?.activeLeagueId,
    leagueRefreshKey,
  );
  const userLeagues = useUserLeagues(authSession.user?.uid, leagueRefreshKey);
  const { data, loading, error, refresh: refreshWorldCupData } = useWorldCupData();

  useAutoSettle(data);

  // Maç verisi geldiğinde bildirimleri planla
  useEffect(() => {
    if (data && authSession.user) {
      scheduleMatchNotifications(data).catch(() => {
        // İzin verilmemişse veya cihaz desteklemiyorsa sessizce geç
      });
    }
  }, [data, authSession.user]);

  const theme = themes[themeMode];
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab !== "profile") {
      setProfileView("profile");
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logoutUser();
    } finally {
      setLoggingOut(false);
    }
  };

  const refreshLeagueData = () => {
    userProfile.refresh();
    setLeagueRefreshKey((current) => current + 1);
  };

  const handleSetActiveLeague = async (leagueId: string) => {
    if (!authSession.user) {
      return;
    }

    await setActiveLeague(authSession.user.uid, leagueId);
    refreshLeagueData();
  };

  const handleLeaveLeague = async (leagueId: string) => {
    if (!authSession.user) {
      return;
    }

    await leaveLeague({
      userId: authSession.user.uid,
      leagueId,
    });
    refreshLeagueData();
  };

  if (authSession.loading || !splashDone) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.hero }]}>
        <StatusBar style="light" />
        <SplashScreen styles={styles} theme={theme} />
      </SafeAreaView>
    );
  }

  if (!authSession.user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
        <View style={styles.backgroundOrnamentTop} />
        <View style={styles.backgroundOrnamentBottom} />
        <AuthScreen styles={styles} theme={theme} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      <View style={styles.backgroundOrnamentTop} />
      <View style={styles.backgroundOrnamentBottom} />

      <View style={styles.appShell}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppHeader
            activeTab={activeTab}
            onProfileAction={() =>
              setProfileView((current) =>
                current === "profile" ? "settings" : "profile",
              )
            }
            profileView={profileView}
            styles={styles}
            theme={theme}
          />

          <TabContent
            activeTab={activeTab}
            styles={styles}
            theme={theme}
            mode={themeMode}
            profileView={profileView}
            onThemeChange={setThemeMode}
            data={data}
            loading={loading}
            error={error}
            currentUserId={authSession.user.uid}
            user={authSession.user}
            profile={userProfile.profile}
            onRefreshProfile={refreshLeagueData}
            userLeagues={userLeagues.leagues}
            userLeaguesLoading={userLeagues.loading}
            userLeaguesError={userLeagues.error}
            onSetActiveLeague={handleSetActiveLeague}
            onOpenPredictionHistory={() => setProfileView("history")}
            onLeaveLeague={handleLeaveLeague}
            activeLeagueName={activeLeague.league?.name}
            activeLeagueId={userProfile.profile?.activeLeagueId}
            leagueMembers={leagueMembers.members}
            league={activeLeague.league}
            leaderboardLoading={leagueMembers.loading}
            leaderboardError={leagueMembers.error}
            onRefreshWorldCupData={refreshWorldCupData}
          />
        </ScrollView>

        <BottomNav
          activeTab={activeTab}
          onChange={handleTabChange}
          styles={styles}
          theme={theme}
        />
      </View>
    </SafeAreaView>
  );
}
