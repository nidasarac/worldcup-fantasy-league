import { MaterialCommunityIcons } from "@expo/vector-icons";
import { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  formatTurkeyMatchLabel,
  getDisplayTeam,
  getFlagEmoji,
  getGameStatus,
  getStageLabel,
  getTurkeyDateTime,
  WorldCupData,
} from "../api/worldCup";
import { getFirebaseDb } from "../lib/firebase";
import { useUserPredictions } from "../hooks/useUserPredictions";
import { getMatchQuestions, getMatchResult } from "../services/matches";
import { buildMatchQuestions } from "../services/questions";
import { getUserMatchPredictionAnswers } from "../services/predictions";
import { getCorrectAnswer } from "../services/scoring";
import { AppStyles } from "../styles";
import {
  MatchResult,
  Prediction,
  PredictionAnswer,
  PredictionQuestion,
} from "../types/firestore";
import { ThemePalette } from "../theme";

type HistoryQuestion =
  | ({ id: string } & PredictionQuestion)
  | {
      id: string;
      prompt: string;
      options: string[];
      points: number;
    };

export function PredictionHistoryScreen({
  styles,
  user,
  theme,
  worldCupData,
  leagueRefreshKey,
}: {
  styles: AppStyles;
  user: User;
  theme: ThemePalette;
  worldCupData?: WorldCupData | null;
  leagueRefreshKey?: number;
}) {
  const userPredictions = useUserPredictions(user.uid, leagueRefreshKey);
  const [matchTeamNames, setMatchTeamNames] = useState<Record<string, { home: string; away: string }>>({});
  const [selectedHistory, setSelectedHistory] = useState<
    (Prediction & { id: string }) | null
  >(null);
  const [historyAnswers, setHistoryAnswers] = useState<
    Array<PredictionAnswer & { id: string }>
  >([]);
  const [historyQuestions, setHistoryQuestions] = useState<HistoryQuestion[]>([]);
  const [historyResult, setHistoryResult] = useState<MatchResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const unresolved = userPredictions.predictions.filter((p) => {
      const found = worldCupData?.games.find((g) => String(g.id) === String(p.matchId));
      return !found && !matchTeamNames[String(p.matchId)] && !p.homeTeamName;
    });
    if (!unresolved.length) return;

    const db = getFirebaseDb();
    Promise.all(
      unresolved.map(async (p) => {
        try {
          const snap = await getDoc(doc(db, "matches", String(p.matchId)));
          if (snap.exists()) {
            const d = snap.data() as { homeTeamName?: string; awayTeamName?: string };
            if (d.homeTeamName && d.awayTeamName) {
              return { id: String(p.matchId), home: d.homeTeamName, away: d.awayTeamName };
            }
          }
        } catch {}
        return null;
      }),
    ).then((results) => {
      const names: Record<string, { home: string; away: string }> = {};
      results.forEach((r) => { if (r) names[r.id] = { home: r.home, away: r.away }; });
      if (Object.keys(names).length) setMatchTeamNames((prev) => ({ ...prev, ...names }));
    });
  }, [userPredictions.predictions, worldCupData?.games]);

  const historyPredictions = useMemo(() => {
    return userPredictions.predictions
      .filter((prediction) => {
        const game = worldCupData?.games.find((item) => String(item.id) === String(prediction.matchId));
        return prediction.status === "settled" || game?.finished === "TRUE";
      })
      .sort((a, b) => {
        const gameA = worldCupData?.games.find((g) => String(g.id) === String(a.matchId));
        const gameB = worldCupData?.games.find((g) => String(g.id) === String(b.matchId));
        const timeA = gameA ? (getTurkeyDateTime(gameA)?.toMillis() ?? 0) : 0;
        const timeB = gameB ? (getTurkeyDateTime(gameB)?.toMillis() ?? 0) : 0;
        return timeB - timeA;
      });
  }, [userPredictions.predictions, worldCupData?.games]);

  const selectedHistoryGame = selectedHistory
    ? worldCupData?.games.find((item) => String(item.id) === String(selectedHistory.matchId)) ?? null
    : null;
  const selectedHistoryHome = selectedHistoryGame
    ? getDisplayTeam(selectedHistoryGame, "home", worldCupData?.teamMap ?? {})
    : null;
  const selectedHistoryAway = selectedHistoryGame
    ? getDisplayTeam(selectedHistoryGame, "away", worldCupData?.teamMap ?? {})
    : null;

  const handleOpenHistory = async (prediction: Prediction & { id: string }) => {
    setSelectedHistory(prediction);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryAnswers([]);
    setHistoryQuestions([]);
    setHistoryResult(null);

    try {
      const game =
        worldCupData?.games.find((item) => String(item.id) === String(prediction.matchId)) ?? null;
      const home = game
        ? getDisplayTeam(game, "home", worldCupData?.teamMap ?? {})
        : null;
      const away = game
        ? getDisplayTeam(game, "away", worldCupData?.teamMap ?? {})
        : null;

      const [answers, storedQuestions, result] = await Promise.all([
        getUserMatchPredictionAnswers(user.uid, prediction.matchId),
        getMatchQuestions(prediction.matchId),
        getMatchResult(prediction.matchId),
      ]);

      const fallbackQuestions =
        home && away
          ? buildMatchQuestions(prediction.matchId, home.name, away.name)
          : [];

      setHistoryAnswers(answers);
      setHistoryQuestions(storedQuestions.length ? storedQuestions : fallbackQuestions);
      setHistoryResult(result);
    } catch (error) {
      setHistoryError(
        error instanceof Error
          ? error.message
          : "Geçmiş tahmin detayları yüklenemedi.",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleCloseHistory = () => {
    setSelectedHistory(null);
    setHistoryAnswers([]);
    setHistoryQuestions([]);
    setHistoryResult(null);
    setHistoryError(null);
    setHistoryLoading(false);
  };

  return (
    <>
      <View style={styles.settingsPanel}>
        <Text style={styles.settingsTitle}>Geçmiş Tahminlerim</Text>
        <Text style={styles.settingsCopy}>
          Sonuçlanan maçlarda yaptığın tahminleri açıp hangi seçimin tuttuğunu
          detaylı olarak görebilirsin.
        </Text>
      </View>

      {userPredictions.loading ? (
        <View style={styles.settingsPanel}>
          <Text style={styles.loadingCopy}>Geçmiş tahminlerin yükleniyor.</Text>
        </View>
      ) : null}

      {userPredictions.error ? (
        <View style={styles.settingsPanel}>
          <Text style={styles.authError}>{userPredictions.error}</Text>
        </View>
      ) : null}

      {!userPredictions.loading &&
      !userPredictions.error &&
      historyPredictions.length === 0 ? (
        <View style={styles.settingsPanel}>
          <Text style={styles.loadingCopy}>
            Sonuçlanan maçlarda henüz kayıtlı bir tahminin görünmüyor.
          </Text>
        </View>
      ) : null}

      {historyPredictions.map((prediction) => {
        const game = worldCupData?.games.find((item) => String(item.id) === String(prediction.matchId));
        const home = game ? getDisplayTeam(game, "home", worldCupData?.teamMap ?? {}) : null;
        const away = game ? getDisplayTeam(game, "away", worldCupData?.teamMap ?? {}) : null;
        const isFinished = game?.finished === "TRUE";
        const isSettled = prediction.status === "settled";

        const homeName = home?.name
          ?? prediction.homeTeamName
          ?? matchTeamNames[String(prediction.matchId)]?.home
          ?? "Ev";
        const awayName = away?.name
          ?? prediction.awayTeamName
          ?? matchTeamNames[String(prediction.matchId)]?.away
          ?? "Dep";
        const homeFlag = home?.flagEmoji ?? getFlagEmoji(homeName);
        const awayFlag = away?.flagEmoji ?? getFlagEmoji(awayName);

        return (
          <Pressable
            key={prediction.id}
            onPress={() => handleOpenHistory(prediction)}
            style={styles.homeMatchCard}
          >
            {/* Üst satır: aşama + tarih */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={styles.matchMetaChip}>
                <Text style={styles.matchMetaChipText}>
                  {game ? getStageLabel(game) : "Maç"}
                </Text>
              </View>
              <Text style={styles.homeMatchMeta}>
                {game ? formatTurkeyMatchLabel(game) : ""}
              </Text>
            </View>

            {/* Takımlar + skor */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              {/* Ev takımı */}
              <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 28 }}>{homeFlag}</Text>
                <Text style={[styles.homeTeamInlineName, { textAlign: "center" }]} numberOfLines={2}>
                  {homeName}
                </Text>
              </View>

              {/* Skor rozeti */}
              <View style={[styles.homeVsBadge, { minWidth: 70 }]}>
                <Text style={styles.homeVsText}>
                  {isFinished ? `${game!.home_score}–${game!.away_score}` : "–"}
                </Text>
              </View>

              {/* Deplasman takımı */}
              <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 28 }}>{awayFlag}</Text>
                <Text style={[styles.homeTeamInlineName, { textAlign: "center" }]} numberOfLines={2}>
                  {awayName}
                </Text>
              </View>
            </View>

            {/* Alt satır: puan + durum */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={styles.homeMatchMeta}>
                  {isSettled && prediction.totalPointsAwarded !== undefined
                    ? `${prediction.totalPointsAwarded} puan kazanıldı`
                    : game ? getGameStatus(game) : ""}
                </Text>
                {isSettled && prediction.isExactHit ? (
                  <View style={[styles.matchMetaChip, { backgroundColor: "#f59e0b" }]}>
                    <Text style={[styles.matchMetaChipText, { color: "#fff" }]}>
                      ⭐ +30 Tam İsabet
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={[
                styles.userLeagueActiveBadge,
                isSettled && styles.predictionSettledBadge,
              ]}>
                <Text style={[
                  styles.userLeagueActiveText,
                  isSettled && styles.predictionSettledBadgeText,
                ]}>
                  {isSettled ? "Tamamlandı" : "Kaydedildi"}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      <Modal
        visible={Boolean(selectedHistory)}
        animationType="fade"
        transparent
        onRequestClose={handleCloseHistory}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.predictionModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTextWrap}>
                <Text style={styles.modalEyebrow}>Tahmin Ekranı</Text>
                <Text style={styles.modalTitle}>
                  {selectedHistoryGame
                    ? formatTurkeyMatchLabel(selectedHistoryGame)
                    : "Tahmin Detayı"}
                </Text>
              </View>
              <Pressable
                onPress={handleCloseHistory}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={theme.ink} />
              </Pressable>
            </View>

            {selectedHistory ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalMatchCard}>
                  <Text style={styles.modalMatchTitle}>
                    {selectedHistoryHome && selectedHistoryAway
                      ? `${selectedHistoryHome.name} – ${selectedHistoryAway.name}`
                      : selectedHistory.homeTeamName && selectedHistory.awayTeamName
                        ? `${selectedHistory.homeTeamName} – ${selectedHistory.awayTeamName}`
                        : matchTeamNames[String(selectedHistory.matchId)]
                          ? `${matchTeamNames[String(selectedHistory.matchId)].home} – ${matchTeamNames[String(selectedHistory.matchId)].away}`
                          : `Maç #${selectedHistory.matchId}`}
                  </Text>
                  {selectedHistoryGame ? (
                    <Text style={styles.modalMatchMeta}>
                      {getStageLabel(selectedHistoryGame)} •{" "}
                      {selectedHistoryGame.stadiumName ?? selectedHistoryGame.stadiumCity ?? "Stadyum bekleniyor"}
                    </Text>
                  ) : null}
                  {historyResult ? (
                    <View
                      style={[
                        styles.matchMetaChip,
                        { alignSelf: "center", marginTop: 4 },
                      ]}
                    >
                      <Text style={styles.matchMetaChipText}>
                        Sonuç • {historyResult.homeScore} - {historyResult.awayScore}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {historyLoading ? (
                  <View style={styles.modalLoadingRow}>
                    <ActivityIndicator color={theme.accent} />
                    <Text style={styles.loadingCopy}>Geçmiş tahminlerin hazırlanıyor.</Text>
                  </View>
                ) : null}

                {historyError ? (
                  <Text style={styles.authError}>{historyError}</Text>
                ) : null}

                {!historyLoading &&
                !historyError &&
                historyQuestions.map((question) => {
                  const answer = historyAnswers.find((item) => item.id === question.id);
                  const selectedValue = answer?.selectedValue ?? null;
                  const correctValue =
                    historyResult && selectedHistoryHome && selectedHistoryAway
                      ? getCorrectAnswer(
                          question.id,
                          historyResult,
                          selectedHistoryHome.name,
                          selectedHistoryAway.name,
                        )
                      : null;

                  return (
                    <View key={question.id} style={styles.modalQuestionCard}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        <Text style={styles.modalQuestionPrompt}>
                          {"prompt" in question ? question.prompt : question.label}
                        </Text>
                        <View style={styles.modalPointsBadge}>
                          <Text style={styles.modalPointsBadgeText}>
                            {"points" in question
                              ? `${question.points}p`
                              : `${question.scoring.points}p`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.modalOptionsWrap}>
                        {question.options.map((option) => {
                          const isSelected = selectedValue === option;
                          const isCorrect = correctValue === option;
                          const showResultColors = Boolean(correctValue);

                          return (
                            <View
                              key={option}
                              style={[
                                styles.modalOptionButton,
                                isSelected && !showResultColors && styles.modalOptionButtonActive,
                                showResultColors &&
                                  isSelected &&
                                  isCorrect &&
                                  styles.historyOptionCorrect,
                                showResultColors &&
                                  isSelected &&
                                  !isCorrect &&
                                  styles.historyOptionWrong,
                                showResultColors &&
                                  !isSelected &&
                                  isCorrect &&
                                  styles.historyOptionCorrect,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.modalOptionText,
                                  isSelected &&
                                    !showResultColors &&
                                    styles.modalOptionTextActive,
                                  showResultColors &&
                                    (isCorrect || isSelected) &&
                                    styles.historyOptionResultText,
                                ]}
                              >
                                {option}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={handleCloseHistory}
                  style={styles.modalSubmitButton}
                >
                  <Text style={styles.modalSubmitButtonText}>Kapat</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
