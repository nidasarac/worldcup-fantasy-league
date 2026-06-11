import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

import { getFirebaseDb } from "../lib/firebase";
import { FirebaseMatch, MatchResult, PredictionQuestion } from "../types/firestore";

export async function getMatchById(matchId: string) {
  const db = getFirebaseDb();
  const snapshot = await getDoc(doc(db, "matches", matchId));
  return snapshot.exists() ? (snapshot.data() as FirebaseMatch) : null;
}

export async function getMatchQuestions(matchId: string) {
  const db = getFirebaseDb();
  const snapshot = await getDocs(collection(db, "matches", matchId, "questions"));
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as PredictionQuestion),
  }));
}

export async function upsertMatch(matchId: string, data: FirebaseMatch) {
  const db = getFirebaseDb();
  await setDoc(doc(db, "matches", matchId), data, { merge: true });
}

export async function getMatchResult(matchId: string): Promise<MatchResult | null> {
  const db = getFirebaseDb();
  const snapshot = await getDoc(doc(db, "matches", matchId, "result", "final"));
  return snapshot.exists() ? (snapshot.data() as MatchResult) : null;
}

export async function setMatchResult(matchId: string, result: MatchResult) {
  const db = getFirebaseDb();
  await setDoc(doc(db, "matches", matchId, "result", "final"), result, {
    merge: true,
  });
}
