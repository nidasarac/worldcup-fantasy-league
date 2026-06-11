import { MaterialCommunityIcons } from "@expo/vector-icons";
import { User } from "firebase/auth";
import { useMemo, useState } from "react";
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
  getGameStatus,
  getStageLabel,
  WorldCupData,
} from "../api/worldCup";
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
}: {
  styles: AppStyles;
  user: User;
  theme: ThemePalette;
  worldCupData?: WorldCupData | null;
}) {
  const userPredictions = useUserPredictions(user.uid);
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

  const historyPredictions = useMemo(() => {
    return userPredictions.predictions.filter((prediction) => {
      const game = worldCupData?.games.find((item) => item.id === prediction.matchId);
      return prediction.status === "settled" || game?.finished === "TRUE";
    });
  }, [userPredictions.predictions, worldCupData?.games]);

  const selectedHistoryGame = selectedHistory
    ? worldCupData?.games.find((item) => item.id === selectedHistory.matchId) ?? null
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
        worldCupData?.games.find((item) => item.id === prediction.matchId) ?? null;
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
        const game = worldCupData?.games.find((item) => item.id === prediction.matchId);
        const home = game
          ? getDisplayTeam(game, "home", worldCupData?.teamMap ?? {})
          : null;
        const away = game
          ? getDisplayTeam(game, "away", worldCupData?.teamMap ?? {})
          : null;

        return (
          <Pressable
            key={prediction.id}
            onPress={() => handleOpenHistory(prediction)}
            style={styles.userLeagueCard}
          >
            <View style={styles.userLeagueBody}>
              <Text style={styles.userLeagueName}>
                {game && home && away
                  ? `${home.name} - ${away.name}`
                  : `Maç #${prediction.matchId}`}
              </Text>
              <Text style={styles.userLeagueMeta}>
                {game
                  ? `${getStageLabel(game)} • ${formatTurkeyMatchLabel(game)}`
                  : `Maç ID: ${prediction.matchId}`}
              </Text>
              {game ? (
                <Text style={styles.userLeagueMeta}>{getGameStatus(game)}</Text>
              ) : null}
            </View>

            <View style={styles.historyListRight}>
              <View
                style={[
                  styles.userLeagueActiveBadge,
                  prediction.status === "settled" && styles.predictionSettledBadge,
                ]}
              >
                <Text
                  style={[
                    styles.userLeagueActiveText,
                    prediction.status === "settled" &&
                      styles.predictionSettledBadgeText,
                  ]}
                >
                  {prediction.status === "settled" ? "Tamamlandı" : "Kaydedildi"}
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.muted}
              />
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
                      : `Maç #${selectedHistory.matchId}`}
                  </Text>
                  {selectedHistoryGame ? (
                    <Text style={styles.modalMatchMeta}>
                      {getStageLabel(selectedHistoryGame)} •{" "}
                      {worldCupData?.stadiumMap[selectedHistoryGame.stadium_id]?.fifa_name ??
                        "Stadyum bekleniyor"}
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
