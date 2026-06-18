import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebase";
import { Prediction, PredictionAnswer } from "../types/firestore";

export async function savePrediction(params: {
  leagueId: string;
  predictionId: string;
  prediction: Prediction;
  answers: PredictionAnswer[];
}) {
  const db = getFirebaseDb();

  await setDoc(
    doc(db, "leagues", params.leagueId, "predictions", params.predictionId),
    {
      ...params.prediction,
      submittedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await Promise.all(
    params.answers.map((answer) =>
      setDoc(
        doc(
          db,
          "leagues",
          params.leagueId,
          "predictions",
          params.predictionId,
          "answers",
          answer.questionId,
        ),
        answer,
        { merge: true },
      ),
    ),
  );
}

export async function saveUserMatchPrediction(params: {
  userId: string;
  matchId: string;
  leagueId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  answers: PredictionAnswer[];
}) {
  const db = getFirebaseDb();

  await setDoc(
    doc(db, "users", params.userId, "predictions", params.matchId),
    {
      userId: params.userId,
      matchId: params.matchId,
      status: "submitted",
      submittedAt: serverTimestamp(),
      ...(params.leagueId ? { leagueId: params.leagueId } : {}),
      ...(params.homeTeamName ? { homeTeamName: params.homeTeamName } : {}),
      ...(params.awayTeamName ? { awayTeamName: params.awayTeamName } : {}),
    },
    { merge: true },
  );

  await Promise.all(
    params.answers.map((answer) =>
      setDoc(
        doc(
          db,
          "users",
          params.userId,
          "predictions",
          params.matchId,
          "answers",
          answer.questionId,
        ),
        answer,
        { merge: true },
      ),
    ),
  );
}

export async function getUserMatchPrediction(
  userId: string,
  matchId: string,
) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    collection(db, "users", userId, "predictions", matchId, "answers"),
  );

  return snapshot.docs.reduce<Record<string, string>>((acc, item) => {
    const data = item.data() as PredictionAnswer;
    acc[item.id] = data.selectedValue;
    return acc;
  }, {});
}

export async function getUserMatchPredictionAnswers(
  userId: string,
  matchId: string,
) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    collection(db, "users", userId, "predictions", matchId, "answers"),
  );

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...(item.data() as PredictionAnswer),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export async function listUserPredictions(userId: string) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, "users", userId, "predictions"));

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...(item.data() as Prediction),
    }))
    .sort((left, right) => {
      const leftTime =
        typeof left.submittedAt === "string"
          ? Date.parse(left.submittedAt)
          : 0;
      const rightTime =
        typeof right.submittedAt === "string"
          ? Date.parse(right.submittedAt)
          : 0;
      return rightTime - leftTime;
    });
}
