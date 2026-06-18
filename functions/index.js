const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const ZAFRONIX_API_KEY = defineSecret("ZAFRONIX_API_KEY");
const ZAFRONIX_BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";

const TEAM_NAME_TR_MAP = {
  Algeria: "Cezayir",
  Argentina: "Arjantin",
  Australia: "Avustralya",
  Austria: "Avusturya",
  Belgium: "Belçika",
  "Bosnia and Herzegovina": "Bosna Hersek",
  Brazil: "Brezilya",
  "Cabo Verde": "Yeşil Burun Adaları",
  "Cape Verde": "Yeşil Burun Adaları",
  Canada: "Kanada",
  Colombia: "Kolombiya",
  "Congo DR": "Kongo DC",
  "DR Congo": "Kongo DC",
  Croatia: "Hırvatistan",
  "Curaçao": "Curaçao",
  Curacao: "Curaçao",
  Czechia: "Çekya",
  "Czech Republic": "Çekya",
  "Côte d'Ivoire": "Fildişi Sahili",
  "Ivory Coast": "Fildişi Sahili",
  Ecuador: "Ekvador",
  Egypt: "Mısır",
  England: "İngiltere",
  France: "Fransa",
  Germany: "Almanya",
  Ghana: "Gana",
  Haiti: "Haiti",
  "IR Iran": "İran",
  Iran: "İran",
  Iraq: "Irak",
  Japan: "Japonya",
  Jordan: "Ürdün",
  "Korea Republic": "Güney Kore",
  "South Korea": "Güney Kore",
  Mexico: "Meksika",
  Morocco: "Fas",
  Netherlands: "Hollanda",
  "New Zealand": "Yeni Zelanda",
  Norway: "Norveç",
  Panama: "Panama",
  Paraguay: "Paraguay",
  Portugal: "Portekiz",
  Qatar: "Katar",
  "Saudi Arabia": "Suudi Arabistan",
  Scotland: "İskoçya",
  Senegal: "Senegal",
  "South Africa": "Güney Afrika",
  Spain: "İspanya",
  Sweden: "İsveç",
  Switzerland: "İsviçre",
  Tunisia: "Tunus",
  "Türkiye": "Türkiye",
  Turkiye: "Türkiye",
  Turkey: "Türkiye",
  USA: "ABD",
  Uruguay: "Uruguay",
  Uzbekistan: "Özbekistan",
};

const ADMIN_EMAILS = ["nidasaracc@gmail.com", "nnidasarac@gmail.com"];

function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Giriş yapman gerekiyor.");
  }
  const email = request.auth.token.email;
  if (request.auth.token.admin !== true && !ADMIN_EMAILS.includes(email)) {
    throw new HttpsError("permission-denied", "Bu işlem için admin yetkisi gerekiyor.");
  }
}

function normalizeForMatch(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseStage(stage) {
  if (!stage) return { stage: "GROUP_STAGE", group: "" };
  if (stage.startsWith("group_")) {
    return { stage: "GROUP_STAGE", group: stage.replace("group_", "").toUpperCase() };
  }
  const map = {
    r32: "ROUND_OF_32",
    r16: "ROUND_OF_16",
    qf: "QUARTER_FINALS",
    sf: "SEMI_FINALS",
    final: "FINAL",
    thirdPlace: "THIRD_PLACE",
    third_place: "THIRD_PLACE",
  };
  return { stage: map[stage] || stage.toUpperCase(), group: "" };
}

async function zafronixFetch(path) {
  const key = ZAFRONIX_API_KEY.value();
  const res = await fetch(`${ZAFRONIX_BASE_URL}${path}`, {
    headers: { "X-API-Key": key },
  });
  if (!res.ok) throw new Error(`Zafronix ${res.status}: ${path}`);
  return res.json();
}

async function fetchAllMatches() {
  const data = await zafronixFetch("/matches?year=2026");
  return data.data || [];
}

async function fetchSingleMatch(matchId) {
  const data = await zafronixFetch(`/matches/${matchId}`);
  return data;
}

function isFinished(match) {
  return match.status === "finished";
}

function buildMatchResultFromZafronix(match, homeDisplayName, awayDisplayName) {
  const h = match.homeScore ?? 0;
  const a = match.awayScore ?? 0;
  const goals = match.goals || [];
  const cards = match.cards || [];
  const stats = match.statistics || {};

  // Goals dizisi boş ama maçta gol var → Zafronix golü henüz doldurmamış, null ile işaretle
  const goalsDataAvailable = goals.length > 0 || (h === 0 && a === 0);

  const firstGoal = goals[0] ?? null;
  const firstGoalTeam = goalsDataAvailable ? (firstGoal ? firstGoal.team : "none") : null;
  const firstGoalMinute = goalsDataAvailable ? (firstGoal?.minute ?? null) : null;

  const halfTimeGoals = goals.filter((g) => g.minute <= 45);
  const halfTimeHomeGoals = goalsDataAvailable ? halfTimeGoals.filter((g) => g.team === "home").length : null;
  const halfTimeAwayGoals = goalsDataAvailable ? halfTimeGoals.filter((g) => g.team === "away").length : null;

  const homeYellowCards = cards.filter((c) => c.team === "home" && c.color === "yellow").length;
  const awayYellowCards = cards.filter((c) => c.team === "away" && c.color === "yellow").length;
  const homeRedCards = cards.filter((c) => c.team === "home" && c.color === "red").length;
  const awayRedCards = cards.filter((c) => c.team === "away" && c.color === "red").length;

  // İstatistik verisi eksik olabilir — 0 yerine null kullan, getCorrectAnswer null → soruyu atla
  const homeCorners = stats.home?.corners ?? null;
  const awayCorners = stats.away?.corners ?? null;

  const firstCard = cards[0] ?? null;
  const firstCardTeam = firstCard ? firstCard.team : "none";

  const homeShots = stats.home?.shotsTotal ?? null;
  const awayShots = stats.away?.shotsTotal ?? null;
  const homePossession = stats.home?.possessionPct ?? null;
  const awayPossession = stats.away?.possessionPct ?? null;
  const homeFouls = stats.home?.fouls ?? null;
  const awayFouls = stats.away?.fouls ?? null;

  const substitutions = match.substitutions || [];
  const firstSubMinute = substitutions.length > 0 ? (substitutions[0].minute ?? null) : null;

  let winner;
  if (h > a) winner = homeDisplayName;
  else if (a > h) winner = awayDisplayName;
  else winner = "Beraberlik";

  return {
    homeScore: h,
    awayScore: a,
    winner,
    bothTeamsScore: h > 0 && a > 0,
    redCard: homeRedCards + awayRedCards > 0,
    homeYellowCards,
    awayYellowCards,
    homeRedCards,
    awayRedCards,
    homeCorners,
    awayCorners,
    halfTimeHomeGoals,
    halfTimeAwayGoals,
    firstHalfGoals: goalsDataAvailable ? (halfTimeHomeGoals ?? 0) + (halfTimeAwayGoals ?? 0) : null,
    firstGoalTeam,
    firstGoalMinute,
    firstCardTeam,
    homeShots,
    awayShots,
    homePossession,
    awayPossession,
    homeFouls,
    awayFouls,
    firstSubMinute,
    resolvedAt: new Date().toISOString(),
  };
}

function hashMatchId(matchId) {
  return String(matchId)
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function pickFromPool(matchId, pool, count) {
  if (pool.length <= count) return [...pool];
  const hash = hashMatchId(matchId);
  const picked = new Set();
  const result = [];
  let i = 0;
  while (result.length < count) {
    const index = (hash + i * 3) % pool.length;
    if (!picked.has(index)) {
      picked.add(index);
      result.push(pool[index]);
    }
    i += 1;
  }
  return result;
}

function applyMultiplier(questions, multiplier) {
  if (multiplier === 1) return questions;
  return questions.map((q) => ({ ...q, points: q.points * multiplier }));
}

function isTurkeyMatch(homeTeamName, awayTeamName) {
  return homeTeamName === "Türkiye" || awayTeamName === "Türkiye";
}

function buildClassicQuestions(homeTeamName, awayTeamName) {
  return [
    { id: "match-result", prompt: "Maç sonucu ne olur?", options: [homeTeamName, "Beraberlik", awayTeamName], points: 6 },
    { id: "home-goals", prompt: `${homeTeamName} kaç gol atar?`, options: ["0", "1", "2", "3+"], points: 7 },
    { id: "away-goals", prompt: `${awayTeamName} kaç gol atar?`, options: ["0", "1", "2", "3+"], points: 7 },
    { id: "total-goals", prompt: "Toplam gol sayısı?", options: ["0–1", "2–3", "4–5", "6+"], points: 8 },
    { id: "both-score", prompt: "Her iki takım da gol atar mı?", options: ["Evet", "Hayır"], points: 6 },
    { id: "goal-diff", prompt: "Gol farkı kaç olur?", options: ["0 (Beraberlik)", "1", "2", "3+"], points: 8 },
  ];
}

const QUESTION_POOL = [
  { id: "clean-sheet", prompt: "Gol yemeyen takım olur mu?", options: ["Olur", "Olmaz"], points: 7 },
  { id: "four-plus-goals", prompt: "Maçta 4 veya daha fazla gol olur mu?", options: ["Olur", "Olmaz"], points: 8 },
  { id: "both-score-2plus", prompt: "Her iki takım da en az 2 gol atar mı?", options: ["Evet", "Hayır"], points: 9 },
  { id: "one-goal-diff", prompt: "Maç tam 1 gol farkıyla biter mi?", options: ["Evet", "Hayır"], points: 8 },
  { id: "total-exact", prompt: "Toplam kaç gol olur? (tam sayı)", options: ["0", "1", "2", "3", "4", "5+"], points: 10 },
  { id: "nil-nil", prompt: "Maç 0–0 biter mi?", options: ["Evet", "Hayır"], points: 10 },
  { id: "over-25", prompt: "Maç 2.5 üstü mü biter?", options: ["Üstü (3+ gol)", "Altı (0–2 gol)"], points: 7 },
  { id: "yellow-cards", prompt: "Toplam sarı kart sayısı?", options: ["0-1", "2-3", "4-5", "6+"], points: 8 },
  { id: "both-teams-carded", prompt: "Her iki takımdan da sarı kart çıkar mı?", options: ["Evet", "Hayır"], points: 7 },
  { id: "red-card-in-match", prompt: "Maçta kırmızı kart çıkar mı?", options: ["Evet", "Hayır"], points: 9 },
  { id: "total-cards", prompt: "Toplam kart sayısı kaç olur?", options: ["0-2", "3-4", "5-6", "7+"], points: 8 },
  { id: "corners-winner", prompt: "Hangi takım daha fazla köşe vuruşu kullanır?", options: [], points: 8 },
  { id: "total-corners", prompt: "Toplam köşe vuruşu sayısı?", options: ["0-4", "5-8", "9-12", "13+"], points: 9 },
  { id: "first-card-team", prompt: "İlk kartı hangi takım alır?", options: [], points: 8 },
  { id: "shots-winner", prompt: "Hangi takım daha fazla şut atar?", options: [], points: 8 },
  { id: "possession-winner", prompt: "Hangi takım topa daha çok sahip olur?", options: [], points: 7 },
  { id: "total-fouls", prompt: "Toplam faul sayısı kaç olur?", options: ["0-10", "11-15", "16-20", "21+"], points: 8 },
  { id: "first-sub-minute", prompt: "İlk değişiklik kaçıncı dakikada yapılır?", options: ["1-30", "31-45", "46-60", "61-90", "Değişiklik Olmaz"], points: 9 },
];

function buildMatchQuestions(matchId, homeTeamName, awayTeamName) {
  const classic = buildClassicQuestions(homeTeamName, awayTeamName);
  const poolPicks = pickFromPool(matchId, QUESTION_POOL, 3).map((q) =>
    q.id === "first-card-team"
      ? { ...q, options: [homeTeamName, awayTeamName, "Kart Çıkmadı"] }
      : ["corners-winner", "shots-winner", "possession-winner"].includes(q.id)
        ? { ...q, options: [homeTeamName, awayTeamName, "Eşit"] }
        : q,
  );
  const multiplier = isTurkeyMatch(homeTeamName, awayTeamName) ? 2 : 1;
  return applyMultiplier([...classic, ...poolPicks], multiplier);
}

function getCorrectAnswer(questionId, result, homeTeamName, awayTeamName) {
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
    case "first-goal-team":
      if (result.firstGoalTeam === "home") return homeTeamName;
      if (result.firstGoalTeam === "away") return awayTeamName;
      if (result.firstGoalTeam == null) return null;
      return "Gol olmaz";
    case "first-goal-minute": {
      const min = result.firstGoalMinute;
      if (min == null) {
        if (result.firstGoalTeam == null) return null;
        return "Gol olmaz";
      }
      if (min <= 15) return "1-15";
      if (min <= 30) return "16-30";
      if (min <= 45) return "31-45";
      if (min <= 60) return "46-60";
      if (min <= 75) return "61-75";
      return "76+";
    }
    case "most-goals-half": {
      if (result.halfTimeHomeGoals == null || result.halfTimeAwayGoals == null) return null;
      const first = result.halfTimeHomeGoals + result.halfTimeAwayGoals;
      const second = h + a - first;
      if (first > second) return "1. Devre";
      if (second > first) return "2. Devre";
      return "Eşit";
    }
    case "total-cards": {
      const tc = (result.homeYellowCards || 0) + (result.awayYellowCards || 0)
               + (result.homeRedCards || 0) + (result.awayRedCards || 0);
      if (tc <= 2) return "0-2";
      if (tc <= 4) return "3-4";
      if (tc <= 6) return "5-6";
      return "7+";
    }
    case "yellow-cards": {
      const yc = (result.homeYellowCards || 0) + (result.awayYellowCards || 0);
      if (yc <= 1) return "0-1";
      if (yc <= 3) return "2-3";
      if (yc <= 5) return "4-5";
      return "6+";
    }
    case "both-teams-carded":
      return (result.homeYellowCards || 0) > 0 && (result.awayYellowCards || 0) > 0 ? "Evet" : "Hayır";
    case "red-card-in-match":
      return (result.homeRedCards || 0) + (result.awayRedCards || 0) > 0 ? "Evet" : "Hayır";
    case "corners-winner": {
      if (result.homeCorners == null || result.awayCorners == null) return null;
      if (result.homeCorners > result.awayCorners) return homeTeamName;
      if (result.awayCorners > result.homeCorners) return awayTeamName;
      return "Eşit";
    }
    case "total-corners": {
      if (result.homeCorners == null || result.awayCorners == null) return null;
      const tc = result.homeCorners + result.awayCorners;
      if (tc <= 4) return "0-4";
      if (tc <= 8) return "5-8";
      if (tc <= 12) return "9-12";
      return "13+";
    }
    case "first-card-team": {
      if (result.firstCardTeam === "home") return homeTeamName;
      if (result.firstCardTeam === "away") return awayTeamName;
      return "Kart Çıkmadı";
    }
    case "shots-winner": {
      if (result.homeShots == null || result.awayShots == null) return null;
      if (result.homeShots > result.awayShots) return homeTeamName;
      if (result.awayShots > result.homeShots) return awayTeamName;
      return "Eşit";
    }
    case "possession-winner": {
      if (result.homePossession == null || result.awayPossession == null) return null;
      if (result.homePossession > result.awayPossession) return homeTeamName;
      if (result.awayPossession > result.homePossession) return awayTeamName;
      return "Eşit";
    }
    case "total-fouls": {
      if (result.homeFouls == null || result.awayFouls == null) return null;
      const tf = result.homeFouls + result.awayFouls;
      if (tf <= 10) return "0-10";
      if (tf <= 15) return "11-15";
      if (tf <= 20) return "16-20";
      return "21+";
    }
    case "first-sub-minute": {
      const fsm = result.firstSubMinute;
      if (fsm == null) return "Değişiklik Olmaz";
      if (fsm <= 30) return "1-30";
      if (fsm <= 45) return "31-45";
      if (fsm <= 60) return "46-60";
      return "61-90";
    }
    default:
      return null;
  }
}

async function getQuestionsForMatch(matchId, homeTeamName, awayTeamName) {
  const snapshot = await db.collection("matches").doc(matchId).collection("questions").get();
  if (!snapshot.empty) {
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      // Firestore sorular points'i scoring.points altında saklar, normalize et
      return {
        id: doc.id,
        ...data,
        points: data.points ?? data.scoring?.points ?? 0,
      };
    });
  }
  return buildMatchQuestions(matchId, homeTeamName, awayTeamName);
}

async function recomputeLeagueRanks(leagueId) {
  const snapshot = await db.collection("leagues").doc(leagueId).collection("members").get();
  const members = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  members.sort((a, b) => {
    if ((b.totalPoints || 0) !== (a.totalPoints || 0)) {
      return (b.totalPoints || 0) - (a.totalPoints || 0);
    }
    if ((b.exactHits || 0) !== (a.exactHits || 0)) {
      return (b.exactHits || 0) - (a.exactHits || 0);
    }
    return String(a.nickname || a.displayName || a.userId).localeCompare(
      String(b.nickname || b.displayName || b.userId),
      "tr",
    );
  });

  const batch = db.batch();
  members.forEach((member, index) => {
    batch.update(
      db.collection("leagues").doc(leagueId).collection("members").doc(member.id),
      { rank: index + 1 },
    );
  });
  await batch.commit();
}

async function settleMatchCore(match, force = false) {
  if (!isFinished(match)) {
    throw new Error("Maç henüz tamamlanmadı.");
  }

  const homeTeamName = TEAM_NAME_TR_MAP[match.homeTeam] || match.homeTeam;
  const awayTeamName = TEAM_NAME_TR_MAP[match.awayTeam] || match.awayTeam;
  const matchId = match.id;

  const result = buildMatchResultFromZafronix(match, homeTeamName, awayTeamName);
  await db.collection("matches").doc(matchId).collection("result").doc("final").set(result);

  const questions = await getQuestionsForMatch(matchId, homeTeamName, awayTeamName);
  const pointsMap = Object.fromEntries(questions.map((q) => [q.id, q.points || 0]));

  const statuses = force ? ["submitted", "settled"] : ["submitted"];
  const snapshots = await Promise.all(
    statuses.map((status) =>
      db.collectionGroup("predictions")
        .where("matchId", "==", matchId)
        .where("status", "==", status)
        .get()
    )
  );

  const userPredictions = snapshots
    .flatMap((s) => s.docs)
    .filter((doc) => doc.ref.path.startsWith("users/"));

  const affectedLeagueIds = new Set();
  let settledCount = 0;

  for (const predDoc of userPredictions) {
    const prediction = predDoc.data();
    const userId = prediction.userId;
    const oldPoints = force ? (prediction.totalPointsAwarded || 0) : 0;
    const oldIsExactHit = force ? (prediction.isExactHit || false) : false;
    const answersSnapshot = await predDoc.ref.collection("answers").get();

    const TAM_ISABET_BONUS = 30;
    let earned = 0;
    let scoreableCount = 0;
    let correctCount = 0;

    for (const answerDoc of answersSnapshot.docs) {
      const answer = answerDoc.data();
      const correct = getCorrectAnswer(answerDoc.id, result, homeTeamName, awayTeamName);

      if (correct == null) {
        continue; // Veri eksik → atla, tam isabet'i etkileme
      }

      scoreableCount++;
      const isCorrect = answer.selectedValue === correct;
      const pts = isCorrect ? (pointsMap[answerDoc.id] || 0) : 0;
      earned += pts;
      if (isCorrect) correctCount++;

      await answerDoc.ref.set(
        { resultStatus: isCorrect ? "correct" : "wrong", awardedPoints: pts },
        { merge: true },
      );
    }

    const allCorrect = scoreableCount > 0 && correctCount === scoreableCount;
    if (allCorrect) earned += TAM_ISABET_BONUS;

    await predDoc.ref.set(
      { status: "settled", totalPointsAwarded: earned, isExactHit: allCorrect, settledAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    const pointsDelta = earned - oldPoints;
    const membershipsSnapshot = await db
      .collectionGroup("members")
      .where("userId", "==", userId)
      .get();

    for (const memberDoc of membershipsSnapshot.docs) {
      const leagueId = memberDoc.ref.parent.parent.id;
      affectedLeagueIds.add(leagueId);
      const memberUpdate = { totalPoints: FieldValue.increment(pointsDelta) };
      if (!oldIsExactHit && allCorrect) memberUpdate.exactHits = FieldValue.increment(1);
      if (oldIsExactHit && !allCorrect) memberUpdate.exactHits = FieldValue.increment(-1);
      await memberDoc.ref.set(memberUpdate, { merge: true });
    }

    settledCount += 1;
  }

  for (const leagueId of affectedLeagueIds) {
    await recomputeLeagueRanks(leagueId);
  }

  return { matchId, settledCount, affectedLeagueCount: affectedLeagueIds.size };
}

// Tüm maçları Firestore'a yazar, bitmiş olanları settle eder (her 30 dk)
exports.syncMatchData = onSchedule(
  { schedule: "every 30 minutes", timeZone: "Europe/Istanbul", secrets: [ZAFRONIX_API_KEY] },
  async () => {
    const matches = await fetchAllMatches();
    const now = new Date();

    const batch = db.batch();
    for (const match of matches) {
      if (!match.id) continue;
      const kickoff = new Date(match.kickoffUtc);
      const opensAt = new Date(kickoff.getTime() - 24 * 60 * 60 * 1000);
      const locksAt = new Date(kickoff.getTime() - 15 * 60 * 1000);

      let status;
      if (isFinished(match)) status = "finished";
      else if (now >= locksAt) status = "locked";
      else if (now >= opensAt) status = "open";
      else status = "upcoming";

      const { stage, group } = parseStage(match.stage);
      const homeTeamName = TEAM_NAME_TR_MAP[match.homeTeam] || match.homeTeam || "TBD";
      const awayTeamName = TEAM_NAME_TR_MAP[match.awayTeam] || match.awayTeam || "TBD";

      batch.set(
        db.collection("matches").doc(match.id),
        {
          externalMatchId: match.id,
          stage,
          group,
          matchday: String(match.matchNo || ""),
          homeTeamId: normalizeForMatch(match.homeTeam),
          awayTeamId: normalizeForMatch(match.awayTeam),
          homeTeamName,
          awayTeamName,
          stadiumId: match.stadiumId || "",
          stadiumName: match.stadium || "",
          kickoffAt: match.kickoffUtc,
          opensAt: opensAt.toISOString(),
          locksAt: locksAt.toISOString(),
          status,
          homeScore: match.homeScore ?? null,
          awayScore: match.awayScore ?? null,
        },
        { merge: true },
      );
    }
    await batch.commit();

    // Bitmiş maçları settle et (kickoff'tan 3 saat sonra)
    const SETTLE_DELAY_MS = 3 * 60 * 60 * 1000;
    const finished = matches.filter(isFinished);
    for (const match of finished) {
      const kickoff = new Date(match.kickoffUtc);
      if (now.getTime() - kickoff.getTime() < SETTLE_DELAY_MS) continue;

      // Firestore'dan override skor ve result durumunu paralel oku
      const [matchDoc, resultDoc, pendingSnap] = await Promise.all([
        db.collection("matches").doc(match.id).get(),
        db.collection("matches").doc(match.id).collection("result").doc("final").get(),
        db.collectionGroup("predictions")
          .where("matchId", "==", match.id)
          .where("status", "==", "submitted")
          .limit(1)
          .get(),
      ]);

      // Result zaten var ve bekleyen tahmin yok → atla
      const hasPendingUserPredictions = pendingSnap.docs.some((d) => d.ref.path.startsWith("users/"));
      if (resultDoc.exists && !hasPendingUserPredictions) continue;

      // Manuel skor override varsa uygula
      const firestoreData = matchDoc.exists ? matchDoc.data() : {};
      const matchWithOverride = firestoreData.scoreManuallyOverridden
        ? { ...match, homeScore: firestoreData.overrideHomeScore, awayScore: firestoreData.overrideAwayScore }
        : match;

      try {
        await settleMatchCore(matchWithOverride);
      } catch (e) {
        console.error(`settle failed for ${match.id}:`, e.message);
      }
    }
  },
);

// Admin: belirli bir maçı settle et
exports.settleMatch = onCall({ secrets: [ZAFRONIX_API_KEY] }, async (request) => {
  assertAdmin(request);
  const matchId = request.data?.matchId;
  if (!matchId) throw new HttpsError("invalid-argument", "matchId zorunlu.");

  try {
    const match = await fetchSingleMatch(matchId);
    return await settleMatchCore(match, true); // force=true: settled tahminleri de yeniden puanlar
  } catch (error) {
    throw new HttpsError(
      "internal",
      error instanceof Error ? error.message : "Maç puanlanamadı.",
    );
  }
});

// Admin: bitmiş tüm maçları settle et
exports.syncFinishedMatches = onCall({ secrets: [ZAFRONIX_API_KEY] }, async (request) => {
  assertAdmin(request);
  const matches = await fetchAllMatches();
  const finished = matches.filter(isFinished);
  const settled = [];

  for (const match of finished) {
    const existing = await db
      .collection("matches")
      .doc(match.id)
      .collection("result")
      .doc("final")
      .get();
    if (existing.exists) continue;

    try {
      await settleMatchCore(match);
      settled.push(match.id);
    } catch (e) {
      console.error(`settle failed for ${match.id}:`, e.message);
    }
  }

  return { settledMatchIds: settled, settledCount: settled.length };
});

// Admin: belirli bir maç için soruları oluştur
exports.syncMatchQuestions = onCall({ secrets: [ZAFRONIX_API_KEY] }, async (request) => {
  assertAdmin(request);
  const matchId = request.data?.matchId;
  if (!matchId) throw new HttpsError("invalid-argument", "matchId zorunlu.");

  const match = await fetchSingleMatch(matchId);
  const homeTeamName = TEAM_NAME_TR_MAP[match.homeTeam] || match.homeTeam;
  const awayTeamName = TEAM_NAME_TR_MAP[match.awayTeam] || match.awayTeam;
  const questions = buildMatchQuestions(matchId, homeTeamName, awayTeamName);

  const batch = db.batch();
  questions.forEach((question, index) => {
    batch.set(
      db.collection("matches").doc(matchId).collection("questions").doc(question.id),
      {
        type: question.id,
        label: question.prompt,
        options: question.options,
        sortOrder: index + 1,
        required: true,
        status: "active",
        scoring: { mode: "exact", points: question.points },
      },
      { merge: true },
    );
  });
  await batch.commit();

  return { matchId, questionCount: questions.length };
});
