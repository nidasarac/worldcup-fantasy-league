import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ApiGame, getDisplayTeam, WorldCupData } from "../api/worldCup";
import {
  archiveManualTestMatchByAdmin,
  countPredictionsForMatch,
  createManualTestMatchByAdmin,
  markTestMatchAsFinishedByAdmin,
  AdminMatchStatus,
  getAdminMatchStatus,
  simulateMatchSettlementByAdmin,
  settleMatchByAdmin,
  syncFinishedMatchesByAdmin,
  syncMatchQuestionsByAdmin,
} from "../services/admin";
import { requestNotificationPermission } from "../services/notifications";
import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

function getNotifications() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as typeof import("expo-notifications");
  } catch {
    return null;
  }
}

async function sendTestNotification(): Promise<string> {
  const N = getNotifications();
  if (!N) return "Bu cihazda bildirimler desteklenmiyor (Expo Go).";
  const granted = await requestNotificationPermission();
  if (!granted) return "Bildirim izni verilmedi.";
  try {
    await N.scheduleNotificationAsync({
      identifier: "test-notification",
      content: {
        title: "Test bildirimi",
        body: "Bildirimler çalışıyor! Maç saatinden 1 saat önce otomatik gelecek.",
      },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
    return "5 saniye sonra bildirim gelecek.";
  } catch (e) {
    return e instanceof Error ? e.message : "Bildirim planlanamadı.";
  }
}

type MatchStatus = "idle" | "fetching" | "settling" | "done" | "error";

type MatchState = {
  status: MatchStatus;
  message: string | null;
};

export function AdminPanel({
  styles,
  theme,
  worldCupData,
  onRefreshWorldCupData,
  onLeagueRefresh,
}: {
  styles: AppStyles;
  theme: ThemePalette;
  worldCupData: WorldCupData | null;
  onRefreshWorldCupData: () => void;
  onLeagueRefresh: () => void;
}) {
  const [matchStates, setMatchStates] = useState<Record<string, MatchState>>({});
  const [statusMap, setStatusMap] = useState<Record<string, AdminMatchStatus>>({});
  const [testNotifMsg, setTestNotifMsg] = useState<string | null>(null);
  const [testingNotif, setTestingNotif] = useState(false);
  const [syncingFinished, setSyncingFinished] = useState(false);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [creatingTestMatch, setCreatingTestMatch] = useState(false);
  const [removingTestMatchId, setRemovingTestMatchId] = useState<string | null>(null);
  const [finishingTestMatchId, setFinishingTestMatchId] = useState<string | null>(null);
  const [testFinishScores, setTestFinishScores] = useState<Record<string, { home: string; away: string }>>({});
  const [testPredictionCounts, setTestPredictionCounts] = useState<Record<string, number>>({});

  const handleTestNotif = async () => {
    setTestingNotif(true);
    setTestNotifMsg(null);
    const msg = await sendTestNotification();
    setTestNotifMsg(msg);
    setTestingNotif(false);
  };

  const setMatchState = (id: string, state: MatchState) =>
    setMatchStates((prev) => ({ ...prev, [id]: state }));

  const finishedGames = worldCupData?.games
    .filter((g) => g.finished === "TRUE")
    .slice(-20)
    .reverse() ?? [];
  const testGames = worldCupData?.games
    .filter((g) => g.source === "manual-test" && g.finished !== "TRUE") ?? [];

  const loadStatuses = async () => {
    if (!finishedGames.length) {
      setStatusMap({});
      return;
    }

    setLoadingStatuses(true);
    try {
      const entries = await Promise.all(
        finishedGames.map(async (game) => [
          game.id,
          await getAdminMatchStatus(game.id),
        ] as const),
      );

      setStatusMap(Object.fromEntries(entries));
    } finally {
      setLoadingStatuses(false);
    }
  };

  useEffect(() => {
    loadStatuses().catch(() => {
      setStatusMap({});
    });
  }, [worldCupData?.games.length]);

  useEffect(() => {
    if (!testGames.length) {
      setTestPredictionCounts({});
      return;
    }

    Promise.all(
      testGames.map(async (game) => [game.id, await countPredictionsForMatch(game.id)] as const),
    )
      .then((entries) => setTestPredictionCounts(Object.fromEntries(entries)))
      .catch(() => setTestPredictionCounts({}));
  }, [testGames.length]);

  const handleFetchAndSettle = async (game: ApiGame) => {
    setMatchState(game.id, {
      status: "settling",
      message: "Maç sonucu ve puanlama işleniyor…",
    });

    try {
      await syncMatchQuestionsByAdmin({
        game,
        worldCupData: worldCupData!,
      });
      const { settledCount } = await settleMatchByAdmin({
        game,
        worldCupData: worldCupData!,
      });

      setMatchState(game.id, {
        status: "done",
        message: `Tamamlandı. ${settledCount} tahmin puanlandı.`,
      });
      onLeagueRefresh();
      await loadStatuses();
    } catch (err) {
      setMatchState(game.id, {
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Maç işlenirken beklenmeyen bir hata oluştu.",
      });
    }
  };

  const handleSyncFinishedMatches = async () => {
    setSyncingFinished(true);
    setTestNotifMsg(null);
    try {
      const { settledCount, processedMatches } = await syncFinishedMatchesByAdmin({
        worldCupData: worldCupData!,
      });
      setTestNotifMsg(
        processedMatches > 0
          ? `${processedMatches} maç işlendi, ${settledCount} tahmin puanlandı.`
          : "İşlenecek bitmiş maç bulunamadı.",
      );
      if (processedMatches > 0) onLeagueRefresh();
      await loadStatuses();
    } catch (error) {
      setTestNotifMsg(
        error instanceof Error
          ? error.message
          : "Biten maçlar senkronize edilemedi.",
      );
    } finally {
      setSyncingFinished(false);
    }
  };

  const getTestScore = (id: string) => testFinishScores[id] ?? { home: "", away: "" };
  const setTestScore = (id: string, key: "home" | "away", val: string) =>
    setTestFinishScores((prev) => ({
      ...prev,
      [id]: { ...getTestScore(id), [key]: val },
    }));

  const handleFinishTestMatch = async (game: ApiGame) => {
    const score = getTestScore(game.id);
    const h = parseInt(score.home || "0", 10);
    const a = parseInt(score.away || "0", 10);
    setFinishingTestMatchId(game.id);
    setMatchState(game.id, { status: "settling", message: null });
    try {
      await markTestMatchAsFinishedByAdmin(game.id, h, a);
      onRefreshWorldCupData();
      setMatchState(game.id, {
        status: "done",
        message: `${h}-${a} skoru girildi. "Biten Maçlar" bölümünde şimdi görünüyor — "İşle" diyebilirsin.`,
      });
    } catch (error) {
      setMatchState(game.id, {
        status: "error",
        message: error instanceof Error ? error.message : "Maç bitirilemedi.",
      });
    } finally {
      setFinishingTestMatchId(null);
    }
  };

  const handleSimulateTest = async (
    game: ApiGame,
    scenario: "home" | "draw" | "away",
  ) => {
    setMatchState(game.id, {
      status: "settling",
      message: "Test sonucu uygulanıyor…",
    });

    try {
      const { settledCount } = await simulateMatchSettlementByAdmin({
        game,
        worldCupData: worldCupData!,
        scenario,
      });

      setMatchState(game.id, {
        status: "done",
        message: `Test tamamlandı. ${settledCount} tahmin puanlandı.`,
      });
      await onRefreshWorldCupData();
      await loadStatuses();
    } catch (err) {
      setMatchState(game.id, {
        status: "error",
        message:
          err instanceof Error
            ? err.message
            : "Test senaryosu uygulanırken hata oluştu.",
      });
    }
  };

  const handleCreateTestMatch = async () => {
    setCreatingTestMatch(true);
    setTestNotifMsg(null);

    try {
      await createManualTestMatchByAdmin();
      onRefreshWorldCupData();
      setTestNotifMsg(
        "Test maçı oluşturuldu. Artık ana sayfada ve fikstürde normal maç gibi görünecek.",
      );
    } catch (error) {
      setTestNotifMsg(
        error instanceof Error
          ? error.message
          : "Test maçı oluşturulamadı.",
      );
    } finally {
      setCreatingTestMatch(false);
    }
  };

  const handleRemoveTestMatch = async (matchId: string) => {
    setRemovingTestMatchId(matchId);
    setTestNotifMsg(null);

    try {
      await archiveManualTestMatchByAdmin(matchId);
      onRefreshWorldCupData();
      setTestNotifMsg("Test maçı listeden kaldırıldı.");
    } catch (error) {
      setTestNotifMsg(
        error instanceof Error
          ? error.message
          : "Test maçı kaldırılamadı.",
      );
    } finally {
      setRemovingTestMatchId(null);
    }
  };

  const summary = useMemo(() => {
    const statuses = Object.values(statusMap);
    const waiting = statuses.filter(
      (item) => item.pendingPredictionCount > 0 || !item.hasResult,
    ).length;
    const settled = statuses.filter((item) => item.settledPredictionCount > 0).length;
    return { waiting, settled };
  }, [statusMap]);

  return (
    <>
    <View style={styles.settingsPanel}>
      <Text style={styles.settingsTitle}>Bildirim Testi</Text>
      <Text style={styles.settingsCopy}>
        Native build'de 5 saniye sonra test bildirimi gönderir.
      </Text>
      <Pressable
        onPress={handleTestNotif}
        disabled={testingNotif}
        style={[styles.authModeButton, { paddingVertical: 14 }]}
      >
        {testingNotif ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Text style={styles.authModeText}>Test Bildirimi Gönder (5 sn)</Text>
        )}
      </Pressable>
      {testNotifMsg ? (
        <Text style={testNotifMsg.includes("gelecek") ? styles.leagueSuccess : styles.authError}>
          {testNotifMsg}
        </Text>
      ) : null}
    </View>

    <View style={styles.settingsPanel}>
      <Text style={styles.settingsTitle}>Admin Paneli</Text>

      <Text style={styles.settingsCopy}>
        Biten maçların soru, sonuç ve puanlama operasyonunu buradan kontrol
        edebilirsin.
      </Text>

      <View style={styles.adminStatusRow}>
        <View style={styles.adminStatusChip}>
          <Text style={styles.adminStatusChipText}>
            Bekleyen maç • {summary.waiting}
          </Text>
        </View>
        <View style={styles.adminStatusChip}>
          <Text style={styles.adminStatusChipText}>
            Puanlanan maç • {summary.settled}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleSyncFinishedMatches}
        disabled={syncingFinished || !worldCupData}
        style={[styles.authModeButton, { paddingVertical: 14, marginBottom: 10 }]}
      >
        {syncingFinished ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Text style={styles.authModeText}>Biten Maçları İşle</Text>
        )}
      </Pressable>

      {loadingStatuses ? (
        <Text style={styles.loadingCopy}>Maç operasyon durumu güncelleniyor.</Text>
      ) : null}

      {finishedGames.length === 0 ? (
        <Text style={styles.settingsCopy}>Henüz biten maç yok.</Text>
      ) : null}

      {finishedGames.map((game) => {

        const homeDisplay = worldCupData
          ? getDisplayTeam(game, "home", worldCupData.teamMap)
          : { name: game.home_team_label ?? "Ev", flag: "" };
        const awayDisplay = worldCupData
          ? getDisplayTeam(game, "away", worldCupData.teamMap)
          : { name: game.away_team_label ?? "Dep", flag: "" };

        const state = matchStates[game.id];
        const status = statusMap[game.id];
        const isLoading =
          state?.status === "fetching" || state?.status === "settling";
        const actionLabel =
          status?.settledPredictionCount ? "Yeniden Puanla" : "İşle";

        return (
          <View key={game.id} style={[styles.userLeagueCard, { marginTop: 8 }]}>
            <View style={styles.userLeagueBody}>
              <Text style={styles.userLeagueName}>
                {homeDisplay.name} {game.home_score}–{game.away_score} {awayDisplay.name}
              </Text>
              <Text style={styles.userLeagueMeta}>{game.local_date}</Text>
              {status ? (
                <View style={styles.adminStatusRow}>
                  <View style={styles.adminStatusChip}>
                    <Text style={styles.adminStatusChipText}>
                      Sorular • {status.questionCount}
                    </Text>
                  </View>
                  <View style={styles.adminStatusChip}>
                    <Text style={styles.adminStatusChipText}>
                      Bekleyen • {status.pendingPredictionCount}
                    </Text>
                  </View>
                  <View style={styles.adminStatusChip}>
                    <Text style={styles.adminStatusChipText}>
                      Puanlanan • {status.settledPredictionCount}
                    </Text>
                  </View>
                </View>
              ) : null}
              {state?.message ? (
                <Text
                  style={
                    state.status === "error" ? styles.authError : styles.leagueSuccess
                  }
                >
                  {state.message}
                </Text>
              ) : null}
            </View>

            {state?.status !== "done" ? (
              <Pressable
                onPress={() => handleFetchAndSettle(game)}
                disabled={isLoading}
                style={[
                  styles.userLeagueAction,
                  isLoading && {
                    backgroundColor: theme.muted,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.heroText} size="small" />
                ) : (
                  <Text style={styles.userLeagueActionText}>{actionLabel}</Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.userLeagueActiveBadge}>
                <Text style={styles.userLeagueActiveText}>Tamam</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>

    <View style={styles.settingsPanel}>
      <Text style={styles.settingsTitle}>Test Senaryosu</Text>
      <Text style={styles.settingsCopy}>
        Canlı maçları etkilemeden ayrı bir test maçı oluştur, tahmin yap ve
        puanlama akışını uçtan uca dene.
      </Text>

      <Pressable
        onPress={handleCreateTestMatch}
        disabled={creatingTestMatch}
        style={[styles.authModeButton, { paddingVertical: 14 }]}
      >
        {creatingTestMatch ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Text style={styles.authModeText}>Test Maçı Oluştur</Text>
        )}
      </Pressable>

      {testGames.length === 0 ? (
        <Text style={styles.settingsCopy}>
          Henüz aktif test maçı yok. Önce yukarıdan oluştur.
        </Text>
      ) : null}

      {testGames.map((game) => {
        const homeDisplay = worldCupData
          ? getDisplayTeam(game, "home", worldCupData.teamMap)
          : { name: game.home_team_label ?? "Ev", flag: "" };
        const awayDisplay = worldCupData
          ? getDisplayTeam(game, "away", worldCupData.teamMap)
          : { name: game.away_team_label ?? "Dep", flag: "" };
        const state = matchStates[game.id];
        const isLoading = state?.status === "settling";

        return (
          <View
            key={`test-${game.id}`}
            style={[
              styles.userLeagueCard,
              { flexDirection: "column", alignItems: "stretch", marginTop: 8 },
            ]}
          >
            {/* Maç başlığı */}
            <Text style={styles.userLeagueName}>
              {homeDisplay.name} vs {awayDisplay.name}
            </Text>
            <Text style={[styles.userLeagueMeta, { marginBottom: 8 }]}>
              {game.local_date} • {testPredictionCounts[game.id] ?? 0} tahmin kaydedildi
            </Text>

            {/* Feedback */}
            {state?.message ? (
              <Text
                style={[
                  state.status === "error" ? styles.authError : styles.leagueSuccess,
                  { marginBottom: 8 },
                ]}
              >
                {state.message}
              </Text>
            ) : null}

            {/* Biten gibi işaretle — skor giriş */}
            <Text style={[styles.userLeagueMeta, { marginBottom: 6 }]}>
              Biten gibi işaretle (sonra "İşle" ile puanla):
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <TextInput
                value={getTestScore(game.id).home}
                onChangeText={(v) => setTestScore(game.id, "home", v.replace(/[^0-9]/g, ""))}
                placeholder="Ev"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                maxLength={2}
                style={[styles.authInput, { flex: 1, textAlign: "center", paddingVertical: 8 }]}
              />
              <Text style={[styles.userLeagueName, { paddingHorizontal: 2 }]}>–</Text>
              <TextInput
                value={getTestScore(game.id).away}
                onChangeText={(v) => setTestScore(game.id, "away", v.replace(/[^0-9]/g, ""))}
                placeholder="Dep"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                maxLength={2}
                style={[styles.authInput, { flex: 1, textAlign: "center", paddingVertical: 8 }]}
              />
              <Pressable
                onPress={() => handleFinishTestMatch(game)}
                disabled={finishingTestMatchId === game.id}
                style={[
                  styles.userLeagueAction,
                  { flex: 2 },
                  finishingTestMatchId === game.id && { backgroundColor: theme.muted },
                ]}
              >
                {finishingTestMatchId === game.id ? (
                  <ActivityIndicator color={theme.heroText} size="small" />
                ) : (
                  <Text style={styles.userLeagueActionText}>Biten Gibi İşaretle</Text>
                )}
              </Pressable>
            </View>

            {/* Anında settle (test senaryosu) */}
            <Text style={[styles.userLeagueMeta, { marginBottom: 6 }]}>
              Anında puanla (firestore kuralları + index testi için):
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => handleRemoveTestMatch(game.id)}
                disabled={removingTestMatchId === game.id}
                style={[
                  styles.adminScenarioButton,
                  { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.line },
                ]}
              >
                <Text style={[styles.adminScenarioButtonText, { color: theme.ink }]}>Sil</Text>
              </Pressable>
              {(["home", "draw", "away"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSimulateTest(game, s)}
                  disabled={isLoading}
                  style={[styles.adminScenarioButton, { flex: 1 }]}
                >
                  <Text style={styles.adminScenarioButtonText}>
                    {s === "home" ? "2-1" : s === "draw" ? "1-1" : "1-2"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
    </>
  );
}
