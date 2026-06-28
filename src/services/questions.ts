export type MatchQuestion = {
  id: string;
  prompt: string;
  options: string[];
  points: number;
};

// Klasik sorular: nihai skor (homeScore, awayScore) üzerinden cevaplanır.
// API-Football soruları: homeYellowCards, awayYellowCards, homeRedCards, awayRedCards,
//   homeCorners, awayCorners alanları MatchResult'ta dolu olmalıdır.

const TURKEY_TEAM_NAMES = ["Türkiye", "Turkiye"];

export function isTurkeyMatch(
  homeTeamName: string,
  awayTeamName: string,
): boolean {
  return (
    TURKEY_TEAM_NAMES.includes(homeTeamName) ||
    TURKEY_TEAM_NAMES.includes(awayTeamName)
  );
}

function hashMatchId(matchId: string): number {
  return matchId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

function pickFromPool(
  matchId: string,
  pool: MatchQuestion[],
  count: number,
): MatchQuestion[] {
  if (pool.length <= count) return [...pool];
  const hash = hashMatchId(matchId);
  const picked = new Set<number>();
  const result: MatchQuestion[] = [];
  let i = 0;
  while (result.length < count) {
    const index = (hash + i * 3) % pool.length;
    if (!picked.has(index)) {
      picked.add(index);
      result.push(pool[index]);
    }
    i++;
  }
  return result;
}

function applyMultiplier(
  questions: MatchQuestion[],
  multiplier: number,
): MatchQuestion[] {
  if (multiplier === 1) return questions;
  return questions.map((q) => ({ ...q, points: q.points * multiplier }));
}

const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "final", "third"]);

export function isKnockoutStage(stage?: string): boolean {
  return !!stage && KNOCKOUT_STAGES.has(stage);
}

// --- Klasik sorular: grup aşaması ---

function buildClassicQuestions(
  homeTeamName: string,
  awayTeamName: string,
): MatchQuestion[] {
  return [
    {
      id: "match-result",
      prompt: "Maç sonucu ne olur?",
      options: [homeTeamName, "Beraberlik", awayTeamName],
      points: 6,
    },
    {
      id: "home-goals",
      prompt: `${homeTeamName} kaç gol atar?`,
      options: ["0", "1", "2", "3+"],
      points: 7,
    },
    {
      id: "away-goals",
      prompt: `${awayTeamName} kaç gol atar?`,
      options: ["0", "1", "2", "3+"],
      points: 7,
    },
    {
      id: "total-goals",
      prompt: "Toplam gol sayısı?",
      options: ["0–1", "2–3", "4–5", "6+"],
      points: 8,
    },
    {
      id: "both-score",
      prompt: "Her iki takım da gol atar mı?",
      options: ["Evet", "Hayır"],
      points: 6,
    },
    {
      id: "goal-diff",
      prompt: "Gol farkı kaç olur?",
      options: ["0 (Beraberlik)", "1", "2", "3+"],
      points: 8,
    },
  ];
}

// --- Klasik sorular: eleme turu (Beraberlik yok, uzatma/penaltı soruları var) ---

function buildKnockoutClassicQuestions(
  homeTeamName: string,
  awayTeamName: string,
): MatchQuestion[] {
  return [
    {
      id: "match-result",
      prompt: "Turu geçen takım kim olur?",
      options: [homeTeamName, awayTeamName],
      points: 6,
    },
    {
      id: "match-end-type",
      prompt: "Maç nasıl biter?",
      options: ["90 dakikada", "Uzatmada", "Penaltılarda"],
      points: 10,
    },
    {
      id: "home-goals",
      prompt: `${homeTeamName} kaç gol atar? (uzatmalar dahil)`,
      options: ["0", "1", "2", "3+"],
      points: 7,
    },
    {
      id: "away-goals",
      prompt: `${awayTeamName} kaç gol atar? (uzatmalar dahil)`,
      options: ["0", "1", "2", "3+"],
      points: 7,
    },
    {
      id: "both-score",
      prompt: "Her iki takım da gol atar mı? (uzatmalar dahil)",
      options: ["Evet", "Hayır"],
      points: 6,
    },
    {
      id: "goes-to-penalties",
      prompt: "Maç penaltılara gider mi?",
      options: ["Gider", "Gitmez"],
      points: 9,
    },
  ];
}

// --- Soru havuzu: her maça 3 tanesi seçilir ---
//
// Skor soruları (home = homeScore, away = awayScore):
// clean-sheet:       (home === 0 || away === 0) ? "Olur" : "Olmaz"
// four-plus-goals:   (home + away >= 4) ? "Olur" : "Olmaz"
// both-score-2plus:  (home >= 2 && away >= 2) ? "Evet" : "Hayır"
// home-win-nil:      (home > away && away === 0) ? "Evet" : "Hayır"
// away-win-nil:      (away > home && home === 0) ? "Evet" : "Hayır"
// one-goal-diff:     (Math.abs(home - away) === 1) ? "Evet" : "Hayır"
// three-plus-diff:   (Math.abs(home - away) >= 3) ? "Evet" : "Hayır"
// home-three-plus:   (home >= 3) ? "Atar" : "Atmaz"
// away-three-plus:   (away >= 3) ? "Atar" : "Atmaz"
// total-exact:       String(home + away) capped at "5+"
// nil-nil:           (home === 0 && away === 0) ? "Evet" : "Hayır"
// over-25:           (home + away >= 3) ? "Üstü" : "Altı"
//
// API-Football soruları (MatchResult'ta homeYellowCards vb. dolu olmalı):
// yellow-cards:      yc=home+away; yc<=1?"0-1": yc<=3?"2-3": yc<=5?"4-5": "6+"
// both-teams-carded: homeYellowCards>0 && awayYellowCards>0 ? "Evet" : "Hayır"
// red-card-in-match: homeRedCards+awayRedCards>0 ? "Evet" : "Hayır"
// corners-winner:    homeCorners>away?"[ev]": away>home?"[dep]": "Eşit"
// total-corners:     tc=home+away; tc<=4?"0-4": tc<=8?"5-8": tc<=12?"9-12": "13+"

const QUESTION_POOL: MatchQuestion[] = [
  {
    id: "clean-sheet",
    prompt: "Gol yemeyen takım olur mu?",
    options: ["Olur", "Olmaz"],
    points: 7,
  },
  {
    id: "four-plus-goals",
    prompt: "Maçta 4 veya daha fazla gol olur mu?",
    options: ["Olur", "Olmaz"],
    points: 8,
  },
  {
    id: "both-score-2plus",
    prompt: "Her iki takım da en az 2 gol atar mı?",
    options: ["Evet", "Hayır"],
    points: 9,
  },
  {
    id: "one-goal-diff",
    prompt: "Maç tam 1 gol farkıyla biter mi?",
    options: ["Evet", "Hayır"],
    points: 8,
  },
  {
    id: "total-exact",
    prompt: "Toplam kaç gol olur? (tam sayı)",
    options: ["0", "1", "2", "3", "4", "5+"],
    points: 10,
  },
  {
    id: "nil-nil",
    prompt: "Maç 0–0 biter mi?",
    options: ["Evet", "Hayır"],
    points: 10,
  },
  {
    id: "over-25",
    prompt: "Maç 2.5 üstü mü biter?",
    options: ["Üstü (3+ gol)", "Altı (0–2 gol)"],
    points: 7,
  },
  // Scorer tabanlı sorular
  {
    id: "first-goal-team",
    prompt: "İlk golü hangi takım atar?",
    options: [], // buildMatchQuestions tarafından doldurulur
    points: 10,
  },
  {
    id: "first-goal-minute",
    prompt: "İlk gol hangi dakika aralığında olur?",
    options: ["1-15", "16-30", "31-45", "46-60", "61-75", "76+", "Gol olmaz"],
    points: 10,
  },
  {
    id: "most-goals-half",
    prompt: "Hangi devre daha golcü olur?",
    options: ["1. Devre", "2. Devre", "Eşit"],
    points: 8,
  },
  // Zafronix soruları: kart, şut, top, faul, değişiklik
  {
    id: "total-cards",
    prompt: "Toplam kart sayısı kaç olur?",
    options: ["0-2", "3-4", "5-6", "7+"],
    points: 8,
  },
  {
    id: "first-card-team",
    prompt: "İlk kartı hangi takım alır?",
    options: [], // buildMatchQuestions tarafından doldurulur
    points: 8,
  },
  {
    id: "shots-winner",
    prompt: "Hangi takım daha fazla şut atar?",
    options: [], // buildMatchQuestions tarafından doldurulur
    points: 8,
  },
  {
    id: "possession-winner",
    prompt: "Hangi takım topa daha çok sahip olur?",
    options: [], // buildMatchQuestions tarafından doldurulur
    points: 7,
  },
  {
    id: "total-fouls",
    prompt: "Toplam faul sayısı kaç olur?",
    options: ["0-10", "11-15", "16-20", "21+"],
    points: 8,
  },
  {
    id: "first-sub-minute",
    prompt: "İlk değişiklik kaçıncı dakikada yapılır?",
    options: ["1-30", "31-45", "46-60", "61-90", "Değişiklik Olmaz"],
    points: 9,
  },
];

// Eleme turuna özel havuz: most-goals-half (AET ile karışır), goal-diff (Beraberlik seçeneği),
// first-sub-minute (61-90 cap AET'te geçersiz) hariç tutulur.
const KNOCKOUT_QUESTION_POOL: MatchQuestion[] = QUESTION_POOL.filter(
  (q) => !["most-goals-half", "goal-diff", "first-sub-minute", "nil-nil"].includes(q.id),
);

// --- Ana fonksiyon ---

export function buildMatchQuestions(
  matchId: string,
  homeTeamName: string,
  awayTeamName: string,
  stage?: string,
): MatchQuestion[] {
  const knockout = isKnockoutStage(stage);
  const classic = knockout
    ? buildKnockoutClassicQuestions(homeTeamName, awayTeamName)
    : buildClassicQuestions(homeTeamName, awayTeamName);
  const pool = knockout ? KNOCKOUT_QUESTION_POOL : QUESTION_POOL;
  const poolPicks = pickFromPool(matchId, pool, 3).map((q) => {
    if (q.id === "first-goal-team") {
      return { ...q, options: [homeTeamName, awayTeamName, "Gol olmaz"] };
    }
    if (q.id === "first-card-team") {
      return { ...q, options: [homeTeamName, awayTeamName, "Kart Çıkmadı"] };
    }
    if (q.id === "shots-winner" || q.id === "possession-winner") {
      return { ...q, options: [homeTeamName, awayTeamName, "Eşit"] };
    }
    if (knockout && (q.id === "total-exact" || q.id === "four-plus-goals" || q.id === "both-score-2plus" || q.id === "clean-sheet" || q.id === "one-goal-diff" || q.id === "over-25")) {
      return { ...q, prompt: q.prompt + " (uzatmalar dahil)" };
    }
    return q;
  });
  const multiplier = isTurkeyMatch(homeTeamName, awayTeamName) ? 2 : 1;
  return applyMultiplier([...classic, ...poolPicks], multiplier);
}
