import { DateTime } from "luxon";
import {
  collection,
  collectionGroup,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  where,
} from "firebase/firestore";

import {
  ApiGame,
  getDisplayTeam,
  getStadiumTimeZone,
  WorldCupData,
} from "../api/worldCup";
import { getFirebaseDb } from "../lib/firebase";
import { setMatchResult } from "./matches";
import { buildMatchQuestions } from "./questions";
import {
  buildMatchResultFromGame,
  settleMatchPredictions,
} from "./scoring";

export type AdminMatchStatus = {
  questionCount: number;
  hasResult: boolean;
  pendingPredictionCount: number;
  settledPredictionCount: number;
  settledAt: string | null;
};

export type TestScenario = "home" | "draw" | "away";

const TEST_MATCH_SOURCE = "manual-test";
const TEST_STADIUM_ID = "7";

function isStatDrivenQuestion(questionId: string) {
  return [
    "yellow-cards",
    "both-teams-carded",
    "red-card-in-match",
    "corners-winner",
    "total-corners",
  ].includes(questionId);
}

function buildQuestionsForAdmin(params: {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  includeStats: boolean;
}) {
  const generated = buildMatchQuestions(
    params.matchId,
    params.homeTeamName,
    params.awayTeamName,
  );

  if (params.includeStats) {
    return generated;
  }

  return generated.filter((question) => !isStatDrivenQuestion(question.id));
}

export async function getAdminMatchStatus(matchId: string): Promise<AdminMatchStatus> {
  const db = getFirebaseDb();
  // İki ayrı query — her ikisi de mevcut (matchId ASC, status ASC) composite index'i kullanır
  const [questionsSnapshot, resultSnapshot, submittedSnapshot, settledSnapshot] =
    await Promise.all([
      getDocs(collection(db, "matches", matchId, "questions")),
      getDoc(doc(db, "matches", matchId, "result", "final")),
      getDocs(
        query(
          collectionGroup(db, "predictions"),
          where("matchId", "==", matchId),
          where("status", "==", "submitted"),
        ),
      ),
      getDocs(
        query(
          collectionGroup(db, "predictions"),
          where("matchId", "==", matchId),
          where("status", "==", "settled"),
        ),
      ),
    ]);

  const pendingPredictionCount = submittedSnapshot.docs.filter((d) =>
    d.ref.path.startsWith("users/"),
  ).length;

  let settledPredictionCount = 0;
  let settledAt: string | null = null;

  settledSnapshot.docs
    .filter((d) => d.ref.path.startsWith("users/"))
    .forEach((predictionDoc) => {
      settledPredictionCount += 1;
      const data = predictionDoc.data() as { settledAt?: string };
      if (data.settledAt && (!settledAt || data.settledAt > settledAt)) {
        settledAt = data.settledAt;
      }
    });

  return {
    questionCount: questionsSnapshot.size,
    hasResult: resultSnapshot.exists(),
    pendingPredictionCount,
    settledPredictionCount,
    settledAt,
  };
}

export async function syncMatchQuestionsByAdmin(params: {
  game: ApiGame;
  worldCupData: WorldCupData;
}) {
  const db = getFirebaseDb();
  const home = getDisplayTeam(params.game, "home", params.worldCupData.teamMap);
  const away = getDisplayTeam(params.game, "away", params.worldCupData.teamMap);
  const questions = buildQuestionsForAdmin({
    matchId: params.game.id,
    homeTeamName: home.name,
    awayTeamName: away.name,
    includeStats: true,
  });

  const batch = writeBatch(db);

  questions.forEach((question, index) => {
    batch.set(
      doc(db, "matches", params.game.id, "questions", question.id),
      {
        type: question.id,
        label: question.prompt,
        options: question.options,
        sortOrder: index + 1,
        required: true,
        status: "active",
        scoring: {
          mode: "exact",
          points: question.points,
        },
      },
      { merge: true },
    );
  });

  batch.set(
    doc(db, "matches", params.game.id),
    {
      externalMatchId: params.game.id,
      homeTeamName: home.name,
      awayTeamName: away.name,
      group: params.game.group,
      matchday: params.game.matchday,
      stage: params.game.type,
      stadiumId: params.game.stadium_id,
      questionsSyncedAt: serverTimestamp(),
      questionCount: questions.length,
    },
    { merge: true },
  );

  await batch.commit();

  return { questionCount: questions.length };
}

export async function settleMatchByAdmin(params: {
  game: ApiGame;
  worldCupData: WorldCupData;
}) {
  const db = getFirebaseDb();
  const home = getDisplayTeam(params.game, "home", params.worldCupData.teamMap);
  const away = getDisplayTeam(params.game, "away", params.worldCupData.teamMap);

  const existingQuestions = await getDocs(
    collection(db, "matches", params.game.id, "questions"),
  );

  if (existingQuestions.empty) {
    await syncMatchQuestionsByAdmin(params);
  }

  const result = buildMatchResultFromGame(params.game, home.name, away.name);
  await setMatchResult(params.game.id, result);

  await setDoc(
    doc(db, "matches", params.game.id),
    {
      resultSyncedAt: serverTimestamp(),
      hasResult: true,
    },
    { merge: true },
  );

  const settlement = await settleMatchPredictions({
    matchId: params.game.id,
    matchResult: result,
    homeTeamName: home.name,
    awayTeamName: away.name,
    regrade: true,
  });

  await setDoc(
    doc(db, "matches", params.game.id),
    {
      settledAt: serverTimestamp(),
      settledCount: settlement.settledCount,
    },
    { merge: true },
  );

  return settlement;
}

function buildTestMatchResult(scenario: TestScenario): {
  homeScore: number;
  awayScore: number;
  bothTeamsScore: boolean;
  redCard: boolean;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  homeCorners: number;
  awayCorners: number;
  halfTimeHomeGoals: number;
  halfTimeAwayGoals: number;
  firstHalfGoals: number;
} {
  if (scenario === "draw") {
    return {
      homeScore: 1,
      awayScore: 1,
      bothTeamsScore: true,
      redCard: false,
      homeYellowCards: 2,
      awayYellowCards: 2,
      homeRedCards: 0,
      awayRedCards: 0,
      homeCorners: 5,
      awayCorners: 5,
      halfTimeHomeGoals: 1,
      halfTimeAwayGoals: 0,
      firstHalfGoals: 1,
    };
  }

  if (scenario === "away") {
    return {
      homeScore: 1,
      awayScore: 2,
      bothTeamsScore: true,
      redCard: false,
      homeYellowCards: 1,
      awayYellowCards: 3,
      homeRedCards: 0,
      awayRedCards: 0,
      homeCorners: 4,
      awayCorners: 6,
      halfTimeHomeGoals: 0,
      halfTimeAwayGoals: 1,
      firstHalfGoals: 1,
    };
  }

  return {
    homeScore: 2,
    awayScore: 1,
    bothTeamsScore: true,
    redCard: false,
    homeYellowCards: 2,
    awayYellowCards: 1,
    homeRedCards: 0,
    awayRedCards: 0,
    homeCorners: 7,
    awayCorners: 4,
    halfTimeHomeGoals: 1,
    halfTimeAwayGoals: 0,
    firstHalfGoals: 1,
  };
}

export async function simulateMatchSettlementByAdmin(params: {
  game: ApiGame;
  worldCupData: WorldCupData;
  scenario: TestScenario;
}) {
  const db = getFirebaseDb();
  const home = getDisplayTeam(params.game, "home", params.worldCupData.teamMap);
  const away = getDisplayTeam(params.game, "away", params.worldCupData.teamMap);

  const existingQuestions = await getDocs(
    collection(db, "matches", params.game.id, "questions"),
  );

  if (existingQuestions.empty) {
    await syncMatchQuestionsByAdmin({
      game: params.game,
      worldCupData: params.worldCupData,
    });
  }

  const base = buildTestMatchResult(params.scenario);
  const result = {
    ...base,
    winner:
      params.scenario === "draw"
        ? "Beraberlik"
        : params.scenario === "away"
          ? away.name
          : home.name,
    resolvedAt: new Date().toISOString(),
  };

  await setMatchResult(params.game.id, result);

  await setDoc(
    doc(db, "matches", params.game.id),
    {
      resultSyncedAt: serverTimestamp(),
      hasResult: true,
      testMode: true,
      testScenario: params.scenario,
    },
    { merge: true },
  );

  const settlement = await settleMatchPredictions({
    matchId: params.game.id,
    matchResult: result,
    homeTeamName: home.name,
    awayTeamName: away.name,
    regrade: true,
  });

  await setDoc(
    doc(db, "matches", params.game.id),
    {
      settledAt: serverTimestamp(),
      settledCount: settlement.settledCount,
      testMode: true,
      testScenario: params.scenario,
    },
    { merge: true },
  );

  return settlement;
}

export async function syncFinishedMatchesByAdmin(params: {
  worldCupData: WorldCupData;
}) {
  const finishedGames = params.worldCupData.games.filter(
    (game) => game.finished === "TRUE",
  );

  let settledCount = 0;
  let processedMatches = 0;

  for (const game of finishedGames) {
    const status = await getAdminMatchStatus(game.id);
    const shouldProcess =
      status.pendingPredictionCount > 0 ||
      status.settledPredictionCount > 0 ||
      !status.hasResult ||
      status.questionCount === 0;

    if (!shouldProcess) {
      continue;
    }

    const result = await settleMatchByAdmin({
      game,
      worldCupData: params.worldCupData,
    });

    settledCount += result.settledCount;
    processedMatches += 1;
  }

  return { settledCount, processedMatches };
}

export async function createManualTestMatchByAdmin() {
  const db = getFirebaseDb();
  const kickoffLocal = DateTime.now()
    .setZone("Europe/Istanbul")
    .plus({ hours: 3 })
    .setZone("America/New_York")
    .toFormat("MM/dd/yyyy HH:mm");

  const activeTests = await getDocs(
    query(
      collection(db, "matches"),
      where("source", "==", TEST_MATCH_SOURCE),
    ),
  );

  const archiveBatch = writeBatch(db);
  activeTests.docs.forEach((item) => {
    const data = item.data() as { testState?: string };
    if (data.testState !== "active") {
      return;
    }
    archiveBatch.set(
      item.ref,
      {
        testState: "archived",
        archivedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  await archiveBatch.commit();

  const id = `test_match_${Date.now()}`;

  await setDoc(
    doc(db, "matches", id),
    {
      source: TEST_MATCH_SOURCE,
      testState: "active",
      externalMatchId: id,
      homeTeamName: "Test FC",
      awayTeamName: "Demo United",
      group: "TEST",
      matchday: "0",
      stage: "group",
      stadiumId: TEST_STADIUM_ID,
      localDate: kickoffLocal,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  return id;
}

export async function markTestMatchAsFinishedByAdmin(
  matchId: string,
  homeScore: number,
  awayScore: number,
) {
  const db = getFirebaseDb();
  await setDoc(
    doc(db, "matches", matchId),
    {
      testFinished: true,
      testHomeScore: homeScore,
      testAwayScore: awayScore,
    },
    { merge: true },
  );
}

export async function archiveManualTestMatchByAdmin(matchId: string) {
  const db = getFirebaseDb();

  await setDoc(
    doc(db, "matches", matchId),
    {
      source: TEST_MATCH_SOURCE,
      testState: "archived",
      archivedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function countPredictionsForMatch(matchId: string) {
  const db = getFirebaseDb();
  const [submitted, settled] = await Promise.all([
    getCountFromServer(
      query(
        collectionGroup(db, "predictions"),
        where("matchId", "==", matchId),
        where("status", "==", "submitted"),
      ),
    ),
    getCountFromServer(
      query(
        collectionGroup(db, "predictions"),
        where("matchId", "==", matchId),
        where("status", "==", "settled"),
      ),
    ),
  ]);
  return submitted.data().count + settled.data().count;
}
