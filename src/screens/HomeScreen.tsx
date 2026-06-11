import { MaterialCommunityIcons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  ApiGame,
  formatTurkeyMatchLabel,
  getDisplayTeam,
  getGameStatus,
  getStageLabel,
  getTurkeyDateTime,
  isSameTurkeyDay,
  WorldCupData,
} from "../api/worldCup";
import { WorldCupHero } from "../components/Cards";
import {
  getUserMatchPrediction,
  saveUserMatchPrediction,
} from "../services/predictions";
import {
  buildMatchQuestions,
  isTurkeyMatch,
} from "../services/questions";
import { AppStyles } from "../styles";
import { ThemePalette } from "../theme";

function formatCountdown(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 dakika";
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `${days} gün ${hours} saat` : `${days} gün`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours} saat ${mins} dk` : `${hours} saat`;
  }
  return `${mins} dakika`;
}

function getPredictionWindowState(game: ApiGame) {
  const kickoff = getTurkeyDateTime(game);

  if (!kickoff) {
    return {
      canPredict: false,
      label: "Saat bekleniyor",
      detail: "Maç saati alındığında tahmin açılış süresi hesaplanacak.",
      countdown: null as string | null,
    };
  }

  const now = DateTime.now().setZone("Europe/Istanbul");
  const diffMinutes = Math.round(kickoff.diff(now, "minutes").minutes);

  if (game.finished === "TRUE") {
    return {
      canPredict: false,
      label: "Tamamlandı",
      detail: "Bu maç için tahmin dönemi sona erdi.",
      countdown: null as string | null,
    };
  }

  if (diffMinutes <= 0) {
    return {
      canPredict: false,
      label: "Maç başladı",
      detail: "Tahmin süresi kapandı.",
      countdown: null as string | null,
    };
  }

  if (diffMinutes <= 15) {
    return {
      canPredict: false,
      label: "Tahmin kapandı",
      detail: "Tahminler son 15 dakika kala otomatik kapanır.",
      countdown: null as string | null,
    };
  }

  if (diffMinutes > 24 * 60) {
    const openMinutes = diffMinutes - 24 * 60;
    const cd = formatCountdown(openMinutes);
    return {
      canPredict: false,
      label: "Yakında açılır",
      detail: `Açılmasına ${cd} kaldı`,
      countdown: `Tahminler ${cd} içinde açılır`,
    };
  }

  const closeMinutes = diffMinutes - 15;
  const cd = formatCountdown(closeMinutes);
  return {
    canPredict: true,
    label: "Tahmin Yap",
    detail: `Kapanmasına ${cd} kaldı`,
    countdown: `Tahmin kapanmasına ${cd} kaldı`,
  };
}

export function HomeScreen({
  styles,
  theme,
  data,
  loading,
  error,
  userId,
  activeLeagueId,
}: {
  styles: AppStyles;
  theme: ThemePalette;
  data: WorldCupData | null;
  loading: boolean;
  error: string | null;
  userId: string;
  activeLeagueId?: string;
}) {
  const [selectedGame, setSelectedGame] = useState<ApiGame | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [loadingSavedPrediction, setLoadingSavedPrediction] = useState(false);
  const [savingPrediction, setSavingPrediction] = useState(false);
  const [predictionMessage, setPredictionMessage] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  const [predictedMatchIds, setPredictedMatchIds] = useState<Record<string, boolean>>({});
  const [loadingInitialPredictions, setLoadingInitialPredictions] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const checkedGamesRef = useRef<Set<string>>(new Set());

  const upcomingGames = useMemo(() => {
    if (!data) return [];

    return [...data.games]
      .filter((game) => game.source !== "manual-test")
      .map((game) => ({ game, date: getTurkeyDateTime(game) }))
      .filter((entry) => entry.date && entry.game.finished !== "TRUE")
      .sort((left, right) => left.date!.toMillis() - right.date!.toMillis())
      .map((entry) => entry.game);
  }, [data]);

  const todayGames = useMemo(() => {
    const now = DateTime.now().setZone("Europe/Istanbul");
    return upcomingGames.filter((game) => isSameTurkeyDay(game, now));
  }, [upcomingGames]);

  const visibleGames = todayGames.length ? todayGames : upcomingGames.slice(0, 4);

  // Bulk-check which visible games the user has already predicted
  useEffect(() => {
    if (!userId || !visibleGames.length) return;

    const unchecked = visibleGames.filter((g) => !checkedGamesRef.current.has(g.id));
    if (!unchecked.length) return;

    unchecked.forEach((g) => checkedGamesRef.current.add(g.id));
    setLoadingInitialPredictions(true);

    Promise.all(
      unchecked.map(async (game) => {
        try {
          const answers = await getUserMatchPrediction(userId, game.id);
          return Object.keys(answers).length > 0 ? game.id : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const newPredicted: Record<string, boolean> = {};
      results.forEach((id) => {
        if (id) newPredicted[id] = true;
      });
      if (Object.keys(newPredicted).length > 0) {
        setPredictedMatchIds((prev) => ({ ...prev, ...newPredicted }));
      }
      setLoadingInitialPredictions(false);
    });
  }, [userId, visibleGames]);

  const modalQuestions = useMemo(() => {
    if (!selectedGame) return [];
    const home = getDisplayTeam(selectedGame, "home", data?.teamMap ?? {});
    const away = getDisplayTeam(selectedGame, "away", data?.teamMap ?? {});
    return buildMatchQuestions(selectedGame.id, home.name, away.name);
  }, [selectedGame, data]);

  const modalPredictionState = useMemo(
    () => (selectedGame ? getPredictionWindowState(selectedGame) : null),
    [selectedGame],
  );

  const handleOpenPrediction = (game: ApiGame) => {
    setPredictionMessage(null);
    setPredictionError(null);
    setSelectedAnswers({});
    setIsViewOnly(false);
    setSelectedGame(game);
  };

  useEffect(() => {
    let active = true;

    if (!selectedGame) {
      setLoadingSavedPrediction(false);
      return () => { active = false; };
    }

    setLoadingSavedPrediction(true);
    setPredictionMessage(null);

    getUserMatchPrediction(userId, selectedGame.id)
      .then((answers) => {
        if (active) {
          setSelectedAnswers(answers);
          if (Object.keys(answers).length > 0) {
            setIsViewOnly(true);
            setPredictedMatchIds((prev) => ({ ...prev, [selectedGame.id]: true }));
          }
        }
      })
      .catch(() => {
        if (active) setSelectedAnswers({});
      })
      .finally(() => {
        if (active) setLoadingSavedPrediction(false);
      });

    return () => { active = false; };
  }, [selectedGame, userId]);

  const handleSavePrediction = async () => {
    if (!selectedGame) return;

    setSavingPrediction(true);
    setPredictionMessage(null);
    setPredictionError(null);

    try {
      await saveUserMatchPrediction({
        userId,
        matchId: selectedGame.id,
        leagueId: activeLeagueId,
        answers: modalQuestions
          .filter((question) => selectedAnswers[question.id])
          .map((question) => ({
            questionId: question.id,
            type: question.id,
            selectedValue: selectedAnswers[question.id],
            awardedPoints: 0,
            resultStatus: "pending" as const,
          })),
      });

      setPredictedMatchIds((prev) => ({ ...prev, [selectedGame.id]: true }));
      setPredictionMessage("Tahminlerin kaydedildi.");
      setTimeout(() => {
        setSelectedGame(null);
        setPredictionMessage(null);
      }, 600);
    } catch (err) {
      setPredictionError(
        err instanceof Error ? err.message : "Tahminler kaydedilemedi.",
      );
    } finally {
      setSavingPrediction(false);
    }
  };

  const modalHome = selectedGame
    ? getDisplayTeam(selectedGame, "home", data?.teamMap ?? {})
    : null;
  const modalAway = selectedGame
    ? getDisplayTeam(selectedGame, "away", data?.teamMap ?? {})
    : null;

  return (
    <>
      <WorldCupHero styles={styles} theme={theme} />

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Günün Maçları</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{visibleGames.length} maç</Text>
          </View>
        </View>
        <Text style={styles.sectionCopy}>
          Tahminler maçtan 24 saat önce açılır ve son 15 dakika kala kapanır.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Maçlar yükleniyor</Text>
          <Text style={styles.loadingCopy}>
            Canlı fikstür verisi alınıyor.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Veri alınamadı</Text>
          <Text style={styles.loadingCopy}>{error}</Text>
        </View>
      ) : null}

      {visibleGames.map((game) => {
        const home = getDisplayTeam(game, "home", data?.teamMap ?? {});
        const away = getDisplayTeam(game, "away", data?.teamMap ?? {});
        const stadium = data?.stadiumMap[game.stadium_id];
        const predictionState = getPredictionWindowState(game);
        const hasPredicted = predictedMatchIds[game.id];
        const isCheckingPrediction = loadingInitialPredictions && !checkedGamesRef.current.has(game.id);

        return (
          <View key={game._id} style={styles.homeMatchCard}>
            <View style={styles.homeMatchTopRow}>
              <View style={styles.matchMetaChip}>
                <Text style={styles.matchMetaChipText}>{getStageLabel(game)}</Text>
              </View>
              <Text style={styles.homeMatchClock}>
                {formatTurkeyMatchLabel(game)}
              </Text>
            </View>

            <View style={styles.homeMatchTeamsRow}>
              <View style={styles.homeTeamInline}>
                {home.flag ? (
                  <Image source={{ uri: home.flag }} style={styles.teamFlagImage} />
                ) : (
                  <Text style={styles.teamFlag}>🏳️</Text>
                )}
                <Text style={styles.homeTeamInlineName}>{home.name}</Text>
              </View>

              <View style={styles.homeVsBadge}>
                <Text style={styles.homeVsText}>
                  {game.home_score} - {game.away_score}
                </Text>
              </View>

              <View style={styles.homeTeamInline}>
                {away.flag ? (
                  <Image source={{ uri: away.flag }} style={styles.teamFlagImage} />
                ) : (
                  <Text style={styles.teamFlag}>🏳️</Text>
                )}
                <Text style={styles.homeTeamInlineName}>{away.name}</Text>
              </View>
            </View>

            <Text style={styles.homeMatchMeta}>
              {stadium?.fifa_name ?? "Stadyum bekleniyor"} •{" "}
              {predictionState.detail}
            </Text>

            <Pressable
              onPress={() => {
                if (hasPredicted || predictionState.canPredict) {
                  handleOpenPrediction(game);
                }
              }}
              disabled={isCheckingPrediction}
              style={[
                styles.predictButton,
                !hasPredicted && !predictionState.canPredict && styles.predictButtonDisabled,
                hasPredicted && styles.predictButtonDone,
              ]}
            >
              {isCheckingPrediction ? (
                <ActivityIndicator color={theme.muted} size="small" />
              ) : (
                <Text
                  style={[
                    styles.predictButtonText,
                    !hasPredicted && !predictionState.canPredict && styles.predictButtonTextDisabled,
                    hasPredicted && styles.predictButtonTextDone,
                  ]}
                >
                  {hasPredicted ? "✓  Tahminlerimi Görüntüle" : predictionState.label}
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}

      {!loading && !error && !visibleGames.length ? (
        <View style={styles.loadingCard}>
          <Text style={styles.loadingTitle}>Bugün gösterilecek maç yok</Text>
          <Text style={styles.loadingCopy}>
            API üzerinde bugüne ya da yakın döneme ait maç bulunamadı.
          </Text>
        </View>
      ) : null}

      <Modal
        visible={Boolean(selectedGame)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedGame(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.predictionModal}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTextWrap}>
                <Text style={styles.modalEyebrow}>Tahmin Ekranı</Text>
                <Text style={styles.modalTitle}>
                  {selectedGame ? formatTurkeyMatchLabel(selectedGame) : ""}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedGame(null)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={theme.ink} />
              </Pressable>
            </View>

            {selectedGame && modalHome && modalAway ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalMatchCard}>
                  <Text style={styles.modalMatchTitle}>
                    {modalHome.name} – {modalAway.name}
                  </Text>
                  <Text style={styles.modalMatchMeta}>
                    {getStageLabel(selectedGame)} •{" "}
                    {data?.stadiumMap[selectedGame.stadium_id]?.fifa_name ?? "Stadyum bekleniyor"}
                  </Text>
                  {modalPredictionState?.countdown ? (
                    <View style={[styles.matchMetaChip, { alignSelf: "center", marginTop: 4 }]}>
                      <Text style={styles.matchMetaChipText}>
                        ⏱  {modalPredictionState.countdown}
                      </Text>
                    </View>
                  ) : null}
                  {isTurkeyMatch(modalHome.name, modalAway.name) ? (
                    <View style={[styles.matchMetaChip, { alignSelf: "center", backgroundColor: theme.accentSoft }]}>
                      <Text style={[styles.matchMetaChipText, { color: theme.accent }]}>
                        🇹🇷 Türkiye maçı — tüm sorular 2× puan
                      </Text>
                    </View>
                  ) : null}
                </View>

                {loadingSavedPrediction ? (
                  <View style={styles.modalLoadingRow}>
                    <ActivityIndicator color={theme.accent} />
                    <Text style={styles.loadingCopy}>Kayıtlı tahminlerin yükleniyor.</Text>
                  </View>
                ) : null}

                {modalQuestions.map((question) => (
                  <View key={question.id} style={styles.modalQuestionCard}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <Text style={styles.modalQuestionPrompt}>
                        {question.prompt}
                      </Text>
                      <View style={styles.modalPointsBadge}>
                        <Text style={styles.modalPointsBadgeText}>{question.points}p</Text>
                      </View>
                    </View>

                    <View style={styles.modalOptionsWrap}>
                      {question.options.map((option) => {
                        const active = selectedAnswers[question.id] === option;

                        return (
                          <Pressable
                            key={option}
                            onPress={() => {
                              if (!isViewOnly) {
                                setSelectedAnswers((current) => ({
                                  ...current,
                                  [question.id]: option,
                                }));
                              }
                            }}
                            style={[
                              styles.modalOptionButton,
                              active && styles.modalOptionButtonActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.modalOptionText,
                                active && styles.modalOptionTextActive,
                              ]}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))}

                {predictionError ? (
                  <Text style={styles.authError}>{predictionError}</Text>
                ) : null}

                {predictionMessage ? (
                  <Text style={styles.leagueSuccess}>{predictionMessage}</Text>
                ) : null}

                <Pressable
                  onPress={isViewOnly ? () => setSelectedGame(null) : handleSavePrediction}
                  disabled={savingPrediction || loadingSavedPrediction}
                  style={styles.modalSubmitButton}
                >
                  {savingPrediction ? (
                    <ActivityIndicator color={theme.heroText} />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>
                      {isViewOnly ? "Kapat" : "Tahminleri Kaydet"}
                    </Text>
                  )}
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}
