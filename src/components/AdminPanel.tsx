import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { ApiGame, getDisplayTeam, WorldCupData } from "../api/worldCup";
import {
  AdminMatchStatus,
  getAdminMatchStatus,
  settleMatchByAdmin,
  settleMatchViaCloudFunction,
  syncFinishedMatchesByAdmin,
  syncMatchQuestionsByAdmin,
} from "../services/admin";
import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

type MatchState = {
  status: "idle" | "fetching" | "settling" | "done" | "error";
  message: string | null;
};

export function AdminPanel({
  styles,
  theme,
  worldCupData,
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
  const [syncingFinished, setSyncingFinished] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [manualScoreOverrides, setManualScoreOverrides] = useState<Record<string, { home: string; away: string }>>({});

  const setMatchState = (id: string, state: MatchState) =>
    setMatchStates((prev) => ({ ...prev, [id]: state }));

  const finishedGames = worldCupData?.games
    .filter((g) => g.finished === "TRUE")
    .slice(-20)
    .reverse() ?? [];

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

  const handleFetchAndSettle = async (game: ApiGame) => {
    setMatchState(game.id, {
      status: "settling",
      message: "Maç sonucu ve puanlama işleniyor…",
    });

    const override = getManualScore(game.id);
    const manualHomeScore = override.home !== "" ? parseInt(override.home, 10) : undefined;
    const manualAwayScore = override.away !== "" ? parseInt(override.away, 10) : undefined;
    const hasManualOverride = manualHomeScore !== undefined && manualAwayScore !== undefined;

    try {
      if (hasManualOverride) {
        // Manuel skor override varsa client-side path (CF skor override desteklemiyor)
        await syncMatchQuestionsByAdmin({ game, worldCupData: worldCupData! });
        const { settledCount } = await settleMatchByAdmin({
          game,
          worldCupData: worldCupData!,
          manualHomeScore,
          manualAwayScore,
        });
        setMatchState(game.id, {
          status: "done",
          message: `Tamamlandı (manuel skor). ${settledCount} tahmin puanlandı.`,
        });
      } else {
        // Cloud Function: Zafronix'ten tam veri çeker (possession, shots, corners dahil)
        const { settledCount } = await settleMatchViaCloudFunction(game.id);
        setMatchState(game.id, {
          status: "done",
          message: `Tamamlandı. ${settledCount} tahmin puanlandı.`,
        });
      }
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
    setSyncMsg(null);
    try {
      const { settledCount, processedMatches } = await syncFinishedMatchesByAdmin({
        worldCupData: worldCupData!,
      });
      setSyncMsg(
        processedMatches > 0
          ? `${processedMatches} maç işlendi, ${settledCount} tahmin puanlandı.`
          : "İşlenecek yeni maç yok.",
      );
      if (processedMatches > 0) onLeagueRefresh();
      await loadStatuses();
    } catch (error) {
      setSyncMsg(
        error instanceof Error
          ? error.message
          : "Biten maçlar senkronize edilemedi.",
      );
    } finally {
      setSyncingFinished(false);
    }
  };

  const getManualScore = (id: string) => manualScoreOverrides[id] ?? { home: "", away: "" };
  const setManualScore = (id: string, key: "home" | "away", val: string) =>
    setManualScoreOverrides((prev) => ({
      ...prev,
      [id]: { ...getManualScore(id), [key]: val },
    }));

  const summary = useMemo(() => {
    const statuses = Object.values(statusMap);
    const waiting = statuses.filter(
      (item) => item.pendingPredictionCount > 0 || !item.hasResult,
    ).length;
    const settled = statuses.filter((item) => item.settledPredictionCount > 0).length;
    return { waiting, settled };
  }, [statusMap]);

  return (
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

      {syncMsg ? (
        <Text style={syncMsg.includes("hata") || syncMsg.includes("edilemedi") ? styles.authError : styles.leagueSuccess}>
          {syncMsg}
        </Text>
      ) : null}

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

        const manualScore = getManualScore(game.id);
        const hasManualOverride = manualScore.home !== "" || manualScore.away !== "";

        return (
          <View key={game.id} style={[styles.userLeagueCard, { flexDirection: "column", alignItems: "stretch", marginTop: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
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
                    isLoading && { backgroundColor: theme.muted },
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

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
              <TextInput
                value={manualScore.home}
                onChangeText={(v) => setManualScore(game.id, "home", v.replace(/[^0-9]/g, ""))}
                placeholder="Ev golü"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                maxLength={2}
                style={[styles.authInput, { flex: 1, textAlign: "center", paddingVertical: 6 }]}
              />
              <Text style={[styles.userLeagueMeta, { paddingHorizontal: 2 }]}>–</Text>
              <TextInput
                value={manualScore.away}
                onChangeText={(v) => setManualScore(game.id, "away", v.replace(/[^0-9]/g, ""))}
                placeholder="Dep golü"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                maxLength={2}
                style={[styles.authInput, { flex: 1, textAlign: "center", paddingVertical: 6 }]}
              />
              <Text style={[styles.userLeagueMeta, { flex: 2, color: hasManualOverride ? theme.accent : theme.muted }]}>
                {hasManualOverride ? "Manuel skor aktif" : "Opsiyonel skor düzelt"}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
