const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const API_FOOTBALL_KEY = defineSecret("API_FOOTBALL_KEY");

const WORLD_CUP_BASE_URL = "https://worldcup26.ir";
const API_FOOTBALL_BASE_URL = "https://api-football-v1.p.rapidapi.com/v3";
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

const TEAM_NAME_TR_MAP = {
  Argentina: "Arjantin",
  Australia: "Avustralya",
  Austria: "Avusturya",
  Belgium: "Belçika",
  "Bosnia and Herzegovina": "Bosna Hersek",
  Brazil: "Brezilya",
  Canada: "Kanada",
  "Cape Verde": "Yeşil Burun Adaları",
  Colombia: "Kolombiya",
  Croatia: "Hırvatistan",
  Curacao: "Curacao",
  "Czech Republic": "Çekya",
  Ecuador: "Ekvador",
  Egypt: "Mısır",
  England: "İngiltere",
  France: "Fransa",
  Germany: "Almanya",
  Ghana: "Gana",
  Haiti: "Haiti",
  Iran: "İran",
  Iraq: "Irak",
  "Ivory Coast": "Fildişi Sahili",
  Jordan: "Ürdün",
  Japan: "Japonya",
  Mexico: "Meksika",
  Morocco: "Fas",
  Netherlands: "Hollanda",
  "New Zealand": "Yeni Zelanda",
  Norway: "Norveç",
  Panama: "Panama",
  Paraguay: "Paraguay",
  Portugal: "Portekiz",
  Qatar: "Katar",
  "South Africa": "Güney Afrika",
  "South Korea": "Güney Kore",
  Saudi: "Suudi Arabistan",
  "Saudi Arabia": "Suudi Arabistan",
  Scotland: "İskoçya",
  Senegal: "Senegal",
  Spain: "İspanya",
  Sweden: "İsveç",
  Switzerland: "İsviçre",
  Tunisia: "Tunus",
  Turkiye: "Türkiye",
  USA: "ABD",
  Uruguay: "Uruguay",
  Uzbekistan: "Özbekistan",
  "DR Congo": "Kongo DC",
  Algeria: "Cezayir",
};

const TEAM_NAME_ALIASES = {
  usa: ["united states"],
  "united states": ["usa"],
  "ivory coast": ["cote d'ivoire", "cotedivoire"],
  "dr congo": ["congo dr", "democratic republic of congo"],
  "south korea": ["korea republic", "korea rep"],
  saudi: ["saudi arabia"],
  turkiye: ["turkey"],
};

const STADIUM_TIME_ZONES = {
  "1": "America/Mexico_City",
  "2": "America/Mexico_City",
  "3": "America/Mexico_City",
  "4": "America/Chicago",
  "5": "America/Chicago",
  "6": "America/Chicago",
  "7": "America/New_York",
  "8": "America/New_York",
  "9": "America/New_York",
  "10": "America/New_York",
  "11": "America/New_York",
  "12": "America/Toronto",
  "13": "America/Vancouver",
  "14": "America/Los_Angeles",
  "15": "America/Los_Angeles",
  "16": "America/Los_Angeles",
};

function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Giriş yapman gerekiyor.");
  }
  if (request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Bu işlem için admin yetkisi gerekiyor.");
  }
}

function normalizeForMatch(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamsMatch(wcName, apiName) {
  const wc = normalizeForMatch(wcName);
  const api = normalizeForMatch(apiName);
  if (wc === api || wc.includes(api) || api.includes(wc)) return true;
  const aliases = TEAM_NAME_ALIASES[wc] || [];
  return aliases.some((alias) => {
    const n = normalizeForMatch(alias);
    return n === api || api.includes(n) || n.includes(api);
  });
}

function getStadiumTimeZone(stadiumId) {
  return STADIUM_TIME_ZONES[String(stadiumId)] || "America/New_York";
}

function formatDateForApiFootball(localDate, stadiumId) {
  const [datePart, timePart] = String(localDate).split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const utcDate = base.toISOString().slice(0, 10);
  const prev = new Date(base.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return [utcDate, prev];
}

async function worldCupFetch(path) {
  const res = await fetch(`${WORLD_CUP_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`World Cup API ${res.status}: ${path}`);
  return res.json();
}

async function apiFootballFetch(path) {
  const key = API_FOOTBALL_KEY.value();
  if (!key) throw new Error("API_FOOTBALL_KEY secret eksik.");
  const res = await fetch(`${API_FOOTBALL_BASE_URL}${path}`, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}: ${path}`);
  const data = await res.json();
  return data.response;
}

function getStat(stats, type) {
  const entry = stats.find((s) => s.type === type);
  return typeof entry?.value === "number" ? entry.value : 0;
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
  return ["Türkiye", "Turkiye"].includes(homeTeamName) || ["Türkiye", "Turkiye"].includes(awayTeamName);
}

function buildClassicQuestions(homeTeamName, awayTeamName) {
  return [
    { id: "match-result", prompt: "Maç sonucu ne olur?", options: [homeTeamName, "Beraberlik", awayTeamName], points: 10 },
    { id: "home-goals", prompt: `${homeTeamName} kaç gol atar?`, options: ["0", "1", "2", "3+"], points: 8 },
    { id: "away-goals", prompt: `${awayTeamName} kaç gol atar?`, options: ["0", "1", "2", "3+"], points: 8 },
    { id: "total-goals", prompt: "Toplam gol sayısı?", options: ["0–1", "2–3", "4–5", "6+"], points: 8 },
    { id: "both-score", prompt: "Her iki takım da gol atar mı?", options: ["Evet", "Hayır"], points: 6 },
    { id: "goal-diff", prompt: "Gol farkı kaç olur?", options: ["0 (Beraberlik)", "1", "2", "3+"], points: 7 },
  ];
}

const QUESTION_POOL = [
  { id: "clean-sheet", prompt: "Gol yemeyen takım olur mu?", options: ["Olur", "Olmaz"], points: 7 },
  { id: "four-plus-goals", prompt: "Maçta 4 veya daha fazla gol olur mu?", options: ["Olur", "Olmaz"], points: 8 },
  { id: "both-score-2plus", prompt: "Her iki takım da en az 2 gol atar mı?", options: ["Evet", "Hayır"], points: 9 },
  { id: "home-win-nil", prompt: "Ev sahibi gol yemeden kazanır mı?", options: ["Evet", "Hayır"], points: 9 },
  { id: "away-win-nil", prompt: "Deplasman gol yemeden kazanır mı?", options: ["Evet", "Hayır"], points: 9 },
  { id: "one-goal-diff", prompt: "Maç tam 1 gol farkıyla biter mi?", options: ["Evet", "Hayır"], points: 8 },
  { id: "three-plus-diff", prompt: "3 veya daha fazla gol farkıyla biter mi?", options: ["Evet", "Hayır"], points: 9 },
  { id: "home-three-plus", prompt: "Ev sahibi 3 veya daha fazla gol atar mı?", options: ["Atar", "Atmaz"], points: 9 },
  { id: "away-three-plus", prompt: "Deplasman 3 veya daha fazla gol atar mı?", options: ["Atar", "Atmaz"], points: 9 },
  { id: "total-exact", prompt: "Toplam kaç gol olur? (tam sayı)", options: ["0", "1", "2", "3", "4", "5+"], points: 10 },
  { id: "nil-nil", prompt: "Maç 0–0 biter mi?", options: ["Evet", "Hayır"], points: 10 },
  { id: "over-25", prompt: "Maç 2.5 üstü mü biter?", options: ["Üstü (3+ gol)", "Altı (0–2 gol)"], points: 7 },
  { id: "yellow-cards", prompt: "Toplam sarı kart sayısı?", options: ["0-1", "2-3", "4-5", "6+"], points: 8 },
  { id: "both-teams-carded", prompt: "Her iki takımdan da sarı kart çıkar mı?", options: ["Evet", "Hayır"], points: 7 },
  { id: "red-card-in-match", prompt: "Maçta kırmızı kart çıkar mı?", options: ["Evet", "Hayır"], points: 9 },
  { id: "corners-winner", prompt: "Hangi takım daha fazla köşe vuruşu kullanır?", options: [], points: 8 },
  { id: "total-corners", prompt: "Toplam köşe vuruşu sayısı?", options: ["0-4", "5-8", "9-12", "13+"], points: 9 },
];

function buildMatchQuestions(matchId, homeTeamName, awayTeamName) {
  const classic = buildClassicQuestions(homeTeamName, awayTeamName);
  const poolPicks = pickFromPool(matchId, QUESTION_POOL, 3).map((q) =>
    q.id === "corners-winner"
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
      const hc = result.homeCorners || 0;
      const ac = result.awayCorners || 0;
      if (hc > ac) return homeTeamName;
      if (ac > hc) return awayTeamName;
      return "Eşit";
    }
    case "total-corners": {
      const tc = (result.homeCorners || 0) + (result.awayCorners || 0);
      if (tc <= 4) return "0-4";
      if (tc <= 8) return "5-8";
      if (tc <= 12) return "9-12";
      return "13+";
    }
    default:
      return null;
  }
}

function buildMatchResultFromGame(game, homeDisplayName, awayDisplayName, stats) {
  const home = parseInt(game.home_score || "0", 10);
  const away = parseInt(game.away_score || "0", 10);
  let winner;
  if (home > away) winner = homeDisplayName;
  else if (away > home) winner = awayDisplayName;
  else winner = "Beraberlik";

  return {
    homeScore: home,
    awayScore: away,
    winner,
    bothTeamsScore: home > 0 && away > 0,
    redCard: ((stats?.homeRedCards || 0) + (stats?.awayRedCards || 0)) > 0,
    homeYellowCards: stats?.homeYellowCards || 0,
    awayYellowCards: stats?.awayYellowCards || 0,
    homeRedCards: stats?.homeRedCards || 0,
    awayRedCards: stats?.awayRedCards || 0,
    homeCorners: stats?.homeCorners || 0,
    awayCorners: stats?.awayCorners || 0,
    halfTimeHomeGoals: stats?.halfTimeHomeGoals,
    halfTimeAwayGoals: stats?.halfTimeAwayGoals,
    firstHalfGoals:
      stats ? (stats.halfTimeHomeGoals || 0) + (stats.halfTimeAwayGoals || 0) : undefined,
    resolvedAt: new Date().toISOString(),
  };
}

async function fetchWorldCupData() {
  const [gamesRes, teamsRes] = await Promise.all([
    worldCupFetch("/get/games"),
    worldCupFetch("/get/teams"),
  ]);
  const games = Array.isArray(gamesRes?.games) ? gamesRes.games : [];
  const teams = Array.isArray(teamsRes?.teams) ? teamsRes.teams : [];
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]));
  return { games, teamMap };
}

function getDisplayTeam(game, side, teamMap) {
  const teamId = side === "home" ? game.home_team_id : game.away_team_id;
  const fallbackLabel = side === "home" ? game.home_team_label : game.away_team_label;
  const team = teamId ? teamMap[teamId] : undefined;
  if (team) {
    return {
      name: TEAM_NAME_TR_MAP[team.name_en] || team.name_en,
      flag: team.flag || "",
    };
  }
  return { name: fallbackLabel || "TBD", flag: "" };
}

async function fetchMatchStats(homeTeamNameEn, awayTeamNameEn, localDate, stadiumId) {
  const dates = formatDateForApiFootball(localDate, stadiumId);
  for (const date of dates) {
    const fixtures = await apiFootballFetch(
      `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&date=${date}`,
    );

    const fixture = fixtures.find(
      (f) =>
        teamsMatch(homeTeamNameEn, f.teams.home.name) &&
        teamsMatch(awayTeamNameEn, f.teams.away.name),
    );

    if (!fixture) continue;

    const teamStats = await apiFootballFetch(
      `/fixtures/statistics?fixture=${fixture.fixture.id}`,
    );

    if (teamStats.length < 2) return null;

    const homeStats = teamStats.find((s) => teamsMatch(homeTeamNameEn, s.team.name));
    const awayStats = teamStats.find((s) => teamsMatch(awayTeamNameEn, s.team.name));
    if (!homeStats || !awayStats) return null;

    return {
      homeYellowCards: getStat(homeStats.statistics, "Yellow Cards"),
      awayYellowCards: getStat(awayStats.statistics, "Yellow Cards"),
      homeRedCards: getStat(homeStats.statistics, "Red Cards"),
      awayRedCards: getStat(awayStats.statistics, "Red Cards"),
      homeCorners: getStat(homeStats.statistics, "Corner Kicks"),
      awayCorners: getStat(awayStats.statistics, "Corner Kicks"),
      halfTimeHomeGoals: fixture.score.halftime.home || 0,
      halfTimeAwayGoals: fixture.score.halftime.away || 0,
      fixtureId: fixture.fixture.id,
    };
  }
  return null;
}

async function getQuestionsForMatch(matchId, homeTeamName, awayTeamName) {
  const snapshot = await db.collection("matches").doc(matchId).collection("questions").get();
  if (!snapshot.empty) {
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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

async function settleMatchCore(matchId) {
  const { games, teamMap } = await fetchWorldCupData();
  const game = games.find((item) => String(item.id) === String(matchId));
  if (!game) {
    throw new Error("Maç bulunamadı.");
  }
  if (game.finished !== "TRUE") {
    throw new Error("Maç henüz tamamlanmadı.");
  }

  const homeDisplay = getDisplayTeam(game, "home", teamMap);
  const awayDisplay = getDisplayTeam(game, "away", teamMap);
  const homeTeam = teamMap[game.home_team_id];
  const awayTeam = teamMap[game.away_team_id];
  const homeNameEn = homeTeam?.name_en || homeDisplay.name;
  const awayNameEn = awayTeam?.name_en || awayDisplay.name;

  const stats = await fetchMatchStats(
    homeNameEn,
    awayNameEn,
    game.local_date,
    game.stadium_id,
  );
  if (!stats) {
    throw new Error("API-Football istatistikleri henüz hazır değil.");
  }

  const result = buildMatchResultFromGame(game, homeDisplay.name, awayDisplay.name, stats);
  await db.collection("matches").doc(String(matchId)).collection("result").doc("final").set(result, { merge: true });

  const questions = await getQuestionsForMatch(String(matchId), homeDisplay.name, awayDisplay.name);
  const pointsMap = Object.fromEntries(questions.map((q) => [q.id, q.points || 0]));

  const predictionsSnapshot = await db
    .collectionGroup("predictions")
    .where("matchId", "==", String(matchId))
    .where("status", "==", "submitted")
    .get();

  const userPredictions = predictionsSnapshot.docs.filter((doc) =>
    doc.ref.path.startsWith("users/"),
  );

  const affectedLeagueIds = new Set();
  let settledCount = 0;

  for (const predDoc of userPredictions) {
    const prediction = predDoc.data();
    const userId = prediction.userId;
    const answersSnapshot = await predDoc.ref.collection("answers").get();

    let earned = 0;
    let allCorrect = answersSnapshot.size > 0;

    for (const answerDoc of answersSnapshot.docs) {
      const answer = answerDoc.data();
      const correct = getCorrectAnswer(
        answerDoc.id,
        result,
        homeDisplay.name,
        awayDisplay.name,
      );

      if (correct == null) {
        allCorrect = false;
        continue;
      }

      const isCorrect = answer.selectedValue === correct;
      const pts = isCorrect ? (pointsMap[answerDoc.id] || 0) : 0;
      earned += pts;
      if (!isCorrect) {
        allCorrect = false;
      }

      await answerDoc.ref.set(
        {
          resultStatus: isCorrect ? "correct" : "wrong",
          awardedPoints: pts,
        },
        { merge: true },
      );
    }

    await predDoc.ref.set(
      {
        status: "settled",
        totalPointsAwarded: earned,
        settledAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const membershipsSnapshot = await db
      .collectionGroup("members")
      .where("userId", "==", userId)
      .get();

    for (const memberDoc of membershipsSnapshot.docs) {
      const leagueId = memberDoc.ref.parent.parent.id;
      affectedLeagueIds.add(leagueId);
      await memberDoc.ref.set(
        {
          totalPoints: FieldValue.increment(earned),
          ...(allCorrect ? { exactHits: FieldValue.increment(1) } : {}),
        },
        { merge: true },
      );
    }

    settledCount += 1;
  }

  for (const leagueId of affectedLeagueIds) {
    await recomputeLeagueRanks(leagueId);
  }

  return {
    matchId: String(matchId),
    settledCount,
    affectedLeagueCount: affectedLeagueIds.size,
  };
}

exports.settleMatch = onCall({ secrets: [API_FOOTBALL_KEY] }, async (request) => {
  assertAdmin(request);
  const matchId = request.data?.matchId;
  if (!matchId) {
    throw new HttpsError("invalid-argument", "matchId zorunlu.");
  }
  try {
    return await settleMatchCore(String(matchId));
  } catch (error) {
    throw new HttpsError(
      "internal",
      error instanceof Error ? error.message : "Maç puanlanamadı.",
    );
  }
});

exports.syncFinishedMatches = onCall({ secrets: [API_FOOTBALL_KEY] }, async (request) => {
  assertAdmin(request);
  const { games } = await fetchWorldCupData();
  const finishedGames = games.filter((game) => game.finished === "TRUE");
  const settled = [];

  for (const game of finishedGames) {
    const existing = await db
      .collection("matches")
      .doc(String(game.id))
      .collection("result")
      .doc("final")
      .get();

    if (existing.exists) continue;

    try {
      const result = await settleMatchCore(String(game.id));
      settled.push(result.matchId);
    } catch {
      // Sessiz geç; sonraki turda tekrar denenecek
    }
  }

  return {
    settledMatchIds: settled,
    settledCount: settled.length,
  };
});

exports.syncMatchQuestions = onCall(async (request) => {
  assertAdmin(request);
  const matchId = request.data?.matchId;
  if (!matchId) {
    throw new HttpsError("invalid-argument", "matchId zorunlu.");
  }

  const { games, teamMap } = await fetchWorldCupData();
  const game = games.find((item) => String(item.id) === String(matchId));
  if (!game) {
    throw new HttpsError("not-found", "Maç bulunamadı.");
  }

  const homeDisplay = getDisplayTeam(game, "home", teamMap);
  const awayDisplay = getDisplayTeam(game, "away", teamMap);
  const questions = buildMatchQuestions(String(matchId), homeDisplay.name, awayDisplay.name);

  const batch = db.batch();
  questions.forEach((question, index) => {
    batch.set(
      db.collection("matches").doc(String(matchId)).collection("questions").doc(question.id),
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
  await batch.commit();

  return { matchId: String(matchId), questionCount: questions.length };
});

exports.syncFinishedMatchesScheduled = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "Europe/Istanbul",
    secrets: [API_FOOTBALL_KEY],
  },
  async () => {
    const { games } = await fetchWorldCupData();
    const finishedGames = games.filter((game) => game.finished === "TRUE");

    for (const game of finishedGames) {
      const existing = await db
        .collection("matches")
        .doc(String(game.id))
        .collection("result")
        .doc("final")
        .get();

      if (existing.exists) continue;

      try {
        await settleMatchCore(String(game.id));
      } catch {
        // Sonraki schedule turunda tekrar denenecek
      }
    }
  },
);
