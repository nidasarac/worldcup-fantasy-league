import { MaterialCommunityIcons } from "@expo/vector-icons";
import { collection, doc, getDocs, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { ApiGame, getDisplayTeam, WorldCupData } from "../api/worldCup";
import { getFirebaseDb } from "../lib/firebase";
import {
  AdminMatchStatus,
  getAdminMatchStatus,
  settleMatchViaCloudFunction,
  syncFinishedMatchesByAdmin,
} from "../services/admin";
import { MatchQuestion } from "../services/questions";
import { getCorrectAnswer } from "../services/scoring";
import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";
import { MatchResult } from "../types/firestore";

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

  // Cevap düzenleme modal state
  const [overrideGame, setOverrideGame] = useState<ApiGame | null>(null);
  const [overrideQuestions, setOverrideQuestions] = useState<MatchQuestion[]>([]);
  const [overrideAnswers, setOverrideAnswers] = useState<Record<string, string>>({});
  const [overrideComputedAnswers, setOverrideComputedAnswers] = useState<Record<string, string>>({});
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

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

    try {
      const { settledCount } = await settleMatchViaCloudFunction(game.id);
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

  const handleOpenAnswerOverride = async (game: ApiGame) => {
    setOverrideGame(game);
    setOverrideLoading(true);
    setOverrideError(null);
    setOverrideAnswers({});
    setOverrideComputedAnswers({});
    setOverrideQuestions([]);

    try {
      const db = getFirebaseDb();
      const homeTeam = worldCupData
        ? getDisplayTeam(game, "home", worldCupData.teamMap).name
        : game.home_team_label ?? "Ev";
      const awayTeam = worldCupData
        ? getDisplayTeam(game, "away", worldCupData.teamMap).name
        : game.away_team_label ?? "Dep";

      const [questionsSnap, resultDoc] = await Promise.all([
        getDocs(collection(db, "matches", game.id, "questions")),
        getDoc(doc(db, "matches", game.id, "result", "final")),
      ]);

      const result = resultDoc.exists() ? (resultDoc.data() as MatchResult) : null;
      const existingOverrides: Record<string, string> = result?.manualAnswerOverrides ?? {};

      const questions: MatchQuestion[] = questionsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          prompt: data.prompt ?? data.label ?? "",
          options: data.options ?? [],
          points: data.points ?? data.scoring?.points ?? 0,
        };
      });

      const computed: Record<string, string> = {};
      if (result) {
        for (const q of questions) {
          const ans = getCorrectAnswer(q.id, result, homeTeam, awayTeam);
          if (ans !== null) computed[q.id] = ans;
        }
      }

      setOverrideQuestions(questions);
      setOverrideComputedAnswers(computed);
      setOverrideAnswers({ ...computed, ...existingOverrides });
    } catch (e) {
      setOverrideError("Sorular yüklenemedi.");
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleSaveOverrides = async () => {
    if (!overrideGame) return;
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      const db = getFirebaseDb();
      const toSave: Record<string, string> = {};
      for (const [qId, selected] of Object.entries(overrideAnswers)) {
        if (selected !== overrideComputedAnswers[qId]) {
          toSave[qId] = selected;
        }
      }
      await setDoc(
        doc(db, "matches", overrideGame.id, "result", "final"),
        { manualAnswerOverrides: toSave },
        { merge: true },
      );
      setOverrideGame(null);
    } catch (e) {
      setOverrideError("Kaydedilemedi.");
    } finally {
      setOverrideSaving(false);
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

  const overrideHomeTeam = overrideGame && worldCupData
    ? getDisplayTeam(overrideGame, "home", worldCupData.teamMap).name
    : overrideGame?.home_team_label ?? "";
  const overrideAwayTeam = overrideGame && worldCupData
    ? getDisplayTeam(overrideGame, "away", worldCupData.teamMap).name
    : overrideGame?.away_team_label ?? "";

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

        return (
          <View key={game.id} style={[styles.userLeagueCard, { flexDirection: "column", alignItems: "stretch", marginTop: 8 }]}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={styles.userLeagueBody}>
                <Text style={styles.userLeagueName}>
                  {homeDisplay.name} {game.home_score}–{game.away_score} {awayDisplay.name}
                </Text>
                <Text style={styles.userLeagueMeta}>{game.local_date}</Text>
                {status ? (
                  <View style={[styles.adminStatusRow, { flexWrap: "nowrap" }]}>
                    <View style={[styles.adminStatusChip, { paddingHorizontal: 6, paddingVertical: 3 }]}>
                      <Text style={[styles.adminStatusChipText, { fontSize: 10 }]}>
                        Sorular • {status.questionCount}
                      </Text>
                    </View>
                    <View style={[styles.adminStatusChip, { paddingHorizontal: 6, paddingVertical: 3 }]}>
                      <Text style={[styles.adminStatusChipText, { fontSize: 10 }]}>
                        Bekleyen • {status.pendingPredictionCount}
                      </Text>
                    </View>
                    <View style={[styles.adminStatusChip, { paddingHorizontal: 6, paddingVertical: 3 }]}>
                      <Text style={[styles.adminStatusChipText, { fontSize: 10 }]}>
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

            {status?.hasResult ? (
              <Pressable
                onPress={() => handleOpenAnswerOverride(game)}
                style={[styles.authModeButton, { marginTop: 10, paddingVertical: 8 }]}
              >
                <Text style={styles.authModeText}>Cevapları Düzenle</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {/* Cevap Düzenleme Modal */}
      <Modal
        visible={overrideGame !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setOverrideGame(null)}
      >
        <View style={styles.modalBackdrop}>
        <View style={styles.predictionModal}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTextWrap}>
              <Text style={styles.modalEyebrow}>Admin — Cevap Düzenle</Text>
              <Text style={styles.modalTitle}>
                {overrideHomeTeam} – {overrideAwayTeam}
              </Text>
            </View>
            <Pressable
              onPress={() => setOverrideGame(null)}
              style={styles.modalCloseButton}
            >
              <MaterialCommunityIcons name="close" size={22} color={theme.ink} />
            </Pressable>
          </View>

          {overrideLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={theme.accent} />
              <Text style={[styles.loadingCopy, { marginTop: 8 }]}>Sorular yükleniyor…</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={[styles.modalMatchCard, { marginBottom: 4 }]}>
                <Text style={styles.modalMatchMeta}>
                  API'den yanlış gelen cevapları düzeltebilirsin. Değiştirdiğin cevaplar override olarak kaydedilir ve puanlama buna göre yapılır.
                </Text>
              </View>

              {overrideQuestions.map((question) => {
                const isOverridden = overrideAnswers[question.id] !== undefined &&
                  overrideAnswers[question.id] !== overrideComputedAnswers[question.id];
                return (
                  <View key={question.id} style={styles.modalQuestionCard}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <Text style={styles.modalQuestionPrompt}>
                        {question.prompt}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        {isOverridden ? (
                          <View style={[styles.modalPointsBadge, { backgroundColor: "#f59e0b" }]}>
                            <Text style={[styles.modalPointsBadgeText, { color: "#fff" }]}>✏️ düzeltildi</Text>
                          </View>
                        ) : null}
                        <View style={styles.modalPointsBadge}>
                          <Text style={styles.modalPointsBadgeText}>{question.points}p</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalOptionsWrap}>
                      {question.options.map((option) => {
                        const isSelected = overrideAnswers[question.id] === option;
                        return (
                          <Pressable
                            key={option}
                            onPress={() =>
                              setOverrideAnswers((prev) => ({ ...prev, [question.id]: option }))
                            }
                            style={[
                              styles.modalOptionButton,
                              isSelected && styles.modalOptionButtonActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalOptionText,
                                isSelected && styles.modalOptionTextActive,
                              ]}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {overrideError ? (
                <Text style={styles.authError}>{overrideError}</Text>
              ) : null}

              <Pressable
                onPress={handleSaveOverrides}
                disabled={overrideSaving}
                style={[styles.modalSubmitButton, overrideSaving && { opacity: 0.6 }]}
              >
                {overrideSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Kaydet</Text>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
        </View>
      </Modal>
    </View>
  );
}
