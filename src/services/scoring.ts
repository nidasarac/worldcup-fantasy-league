import {
  collection,
  collectionGroup,
  getDocs,
  query,
  serverTimestamp,
  writeBatch,
  where,
} from "firebase/firestore";


import { ApiGame } from "../api/worldCup";
import { getFirebaseDb } from "../lib/firebase";
import {
  MatchResult,
  PredictionAnswer,
  PredictionQuestion,
} from "../types/firestore";
import { buildMatchQuestions } from "./questions";

function parseScorers(raw: string): Array<{ name: string; minute: number }> {
  if (!raw || raw === "null") return [];
  const inner = raw.replace(/^\{/, "").replace(/\}$/, "").replace(/"/g, "");
  return inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+?)\s+(\d+)\+?'?$/);
      if (!m) return null;
      return { name: m[1].trim(), minute: parseInt(m[2], 10) };
    })
    .filter((x): x is { name: string; minute: number } => x !== null);
}

export function buildMatchResultFromGame(
  game: ApiGame,
  homeDisplayName: string,
  awayDisplayName: string,
): MatchResult {
  const home = parseInt(game.home_score || "0", 10);
  const away = parseInt(game.away_score || "0", 10);
  let winner: string;
  if (home > away) winner = homeDisplayName;
  else if (away > home) winner = awayDisplayName;
  else winner = "Beraberlik";

  const homeScorers = parseScorers(game.home_scorers ?? "");
  const awayScorers = parseScorers(game.away_scorers ?? "");

  const allScorers = [
    ...homeScorers.map((s) => ({ ...s, team: "home" as const })),
    ...awayScorers.map((s) => ({ ...s, team: "away" as const })),
  ].sort((a, b) => a.minute - b.minute);

  const firstGoal = allScorers[0] ?? null;
  const halfTimeHomeGoals = homeScorers.filter((s) => s.minute <= 45).length;
  const halfTimeAwayGoals = awayScorers.filter((s) => s.minute <= 45).length;

  return {
    homeScore: home,
    awayScore: away,
    winner,
    bothTeamsScore: home > 0 && away > 0,
    redCard: false,
    firstGoalTeam: firstGoal ? firstGoal.team : "none",
    firstGoalMinute: firstGoal?.minute,
    halfTimeHomeGoals,
    halfTimeAwayGoals,
    firstHalfGoals: halfTimeHomeGoals + halfTimeAwayGoals,
    resolvedAt: new Date().toISOString(),
  };
}

export function getCorrectAnswer(
  questionId: string,
  result: MatchResult,
  homeTeamName: string,
  awayTeamName: string,
): string | null {
  const h = result.homeScore;
  const a = result.awayScore;

  switch (questionId) {
    case "match-result":
      if (h > a) return homeTeamName;
      if (a > h) return awayTeamName;
      return "Beraberlik";
    case "home-goals":
      return h >= 3 ? "3+" : String(h);
    case "away-goals":
      return a >= 3 ? "3+" : String(a);
    case "total-goals": {
      const t = h + a;
      if (t <= 1) return "0–1";
      if (t <= 3) return "2–3";
      if (t <= 5) return "4–5";
      return "6+";
    }
    case "both-score":
      return h > 0 && a > 0 ? "Evet" : "Hayır";
    case "goal-diff": {
      const d = Math.abs(h - a);
      if (d === 0) return "0 (Beraberlik)";
      if (d === 1) return "1";
      if (d === 2) return "2";
      return "3+";
    }
    case "clean-sheet":
      return h === 0 || a === 0 ? "Olur" : "Olmaz";
    case "four-plus-goals":
      return h + a >= 4 ? "Olur" : "Olmaz";
    case "both-score-2plus":
      return h >= 2 && a >= 2 ? "Evet" : "Hayır";
    case "home-win-nil":
      return h > a && a === 0 ? "Evet" : "Hayır";
    case "away-win-nil":
      return a > h && h === 0 ? "Evet" : "Hayır";
    case "one-goal-diff":
      return Math.abs(h - a) === 1 ? "Evet" : "Hayır";
    case "three-plus-diff":
      return Math.abs(h - a) >= 3 ? "Evet" : "Hayır";
    case "home-three-plus":
      return h >= 3 ? "Atar" : "Atmaz";
    case "away-three-plus":
      return a >= 3 ? "Atar" : "Atmaz";
    case "total-exact":
      return h + a >= 5 ? "5+" : String(h + a);
    case "nil-nil":
      return h === 0 && a === 0 ? "Evet" : "Hayır";
    case "over-25":
      return h + a >= 3 ? "Üstü (3+ gol)" : "Altı (0–2 gol)";

    // Scorer tabanlı sorular
    case "first-goal-team":
      if (result.firstGoalTeam === "home") return homeTeamName;
      if (result.firstGoalTeam === "away") return awayTeamName;
      return "Gol olmaz";
    case "first-goal-minute": {
      const min = result.firstGoalMinute;
      if (min == null) return "Gol olmaz";
      if (min <= 15) return "1-15";
      if (min <= 30) return "16-30";
      if (min <= 45) return "31-45";
      if (min <= 60) return "46-60";
      if (min <= 75) return "61-75";
      return "76+";
    }
    case "most-goals-half": {
      const first = (result.halfTimeHomeGoals ?? 0) + (result.halfTimeAwayGoals ?? 0);
      const second = result.homeScore + result.awayScore - first;
      if (first > second) return "1. Devre";
      if (second > first) return "2. Devre";
      return "Eşit";
    }
    default:
      return null;
  }
}

// Bir maçın tüm kullanıcı tahminlerini puanlar ve lig sıralamalarını günceller.
// Firestore composite index gerektirir:
//   Collection group: predictions | Fields: matchId ASC, status ASC
export async function settleMatchPredictions(params: {
  matchId: string;
  matchResult: MatchResult;
  homeTeamName: string;
  awayTeamName: string;
  regrade?: boolean; // true → zaten puanlanmış tahminleri de yeniden puanla
}): Promise<{ settledCount: number }> {
  const db = getFirebaseDb();
  const { matchId, matchResult, homeTeamName, awayTeamName, regrade = false } = params;

  const storedQuestionsSnapshot = await getDocs(
    collection(db, "matches", matchId, "questions"),
  );

  const pointsMap = storedQuestionsSnapshot.empty
    ? Object.fromEntries(
        buildMatchQuestions(matchId, homeTeamName, awayTeamName).map((q) => [
          q.id,
          q.points,
        ]),
      )
    : Object.fromEntries(
        storedQuestionsSnapshot.docs.map((docItem) => {
          const data = docItem.data() as PredictionQuestion;
          return [docItem.id, data.scoring.points];
        }),
      );

  const statuses = regrade ? ["submitted", "settled"] : ["submitted"];
  const predSnapshots = await Promise.all(
    statuses.map((status) =>
      getDocs(
        query(
          collectionGroup(db, "predictions"),
          where("matchId", "==", matchId),
          where("status", "==", status),
        ),
      ),
    ),
  );

  // Sadece users/{uid}/predictions/{matchId} yolundaki tahminler
  const userPredictions = predSnapshots
    .flatMap((snap) => snap.docs)
    .filter((d) => d.ref.path.startsWith("users/"));

  let settledCount = 0;
  const affectedLeagueIds = new Set<string>();

  await Promise.all(
    userPredictions.map(async (predDoc) => {
      const predData = predDoc.data() as { userId: string; leagueId?: string };
      const userId = predData.userId;
      const leagueId = predData.leagueId;
      const answersSnapshot = await getDocs(collection(predDoc.ref, "answers"));
      const batch = writeBatch(db);

      let earned = 0;
      let correctCount = 0;
      let scorableCount = 0;

      answersSnapshot.docs.forEach((answerDoc) => {
        const answer = answerDoc.data() as PredictionAnswer;

        const correct = getCorrectAnswer(
          answerDoc.id,
          matchResult,
          homeTeamName,
          awayTeamName,
        );

        if (correct === null) {
          // Artık geçersiz soru (eski API soruları) — puanı sıfırla
          if (regrade) {
            batch.set(answerDoc.ref, { ...answer, resultStatus: "not-applicable", awardedPoints: 0 }, { merge: true });
          }
          return;
        }

        scorableCount += 1;
        const isCorrect = answer.selectedValue === correct;
        const pts = isCorrect ? (pointsMap[answerDoc.id] ?? 0) : 0;

        if (isCorrect) {
          correctCount += 1;
        }

        earned += pts;

        batch.set(
          answerDoc.ref,
          {
            ...answer,
            resultStatus: isCorrect ? "correct" : "wrong",
            awardedPoints: pts,
          },
          { merge: true },
        );
      });

      const isExactHit = scorableCount > 0 && correctCount === scorableCount;

      batch.set(
        predDoc.ref,
        {
          ...predDoc.data(),
          status: "settled",
          totalPointsAwarded: earned,
          isExactHit,
          settledAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await batch.commit();
      if (leagueId) affectedLeagueIds.add(leagueId);
      settledCount++;
    }),
  );

  await Promise.all(
    Array.from(affectedLeagueIds).map(async (leagueId) => {
      const membersSnapshot = await getDocs(
        collection(db, "leagues", leagueId, "members"),
      );

      const nextMembers = await Promise.all(
        membersSnapshot.docs.map(async (memberDoc) => {
          const predictions = await getDocs(
            collection(db, "users", memberDoc.id, "predictions"),
          );

          let totalPoints = 0;
          let exactHits = 0;

          predictions.docs.forEach((predictionDoc) => {
            const predictionData = predictionDoc.data() as {
              status?: string;
              totalPointsAwarded?: number;
              isExactHit?: boolean;
            };

            if (predictionData.status === "settled") {
              totalPoints += predictionData.totalPointsAwarded ?? 0;
              if (predictionData.isExactHit) {
                exactHits += 1;
              }
            }
          });

          return {
            ref: memberDoc.ref,
            id: memberDoc.id,
            totalPoints,
            exactHits,
          };
        }),
      );

      nextMembers.sort((left, right) => {
        if (right.totalPoints !== left.totalPoints) {
          return right.totalPoints - left.totalPoints;
        }
        if (right.exactHits !== left.exactHits) {
          return right.exactHits - left.exactHits;
        }
        return left.id.localeCompare(right.id);
      });

      const rankBatch = writeBatch(db);
      nextMembers.forEach((member, index) => {
        rankBatch.update(member.ref, {
          totalPoints: member.totalPoints,
          exactHits: member.exactHits,
          rank: index + 1,
        });
      });
      await rankBatch.commit();
    }),
  );

  return { settledCount };
}
