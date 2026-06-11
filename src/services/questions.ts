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

// --- Klasik sorular: her maçta bulunur, tümü final skor ile cevaplanır ---

function buildClassicQuestions(
  homeTeamName: string,
  awayTeamName: string,
): MatchQuestion[] {
  return [
    {
      id: "match-result",
      prompt: "Maç sonucu ne olur?",
      options: [homeTeamName, "Beraberlik", awayTeamName],
      points: 10,
    },
    {
      id: "home-goals",
      prompt: `${homeTeamName} kaç gol atar?`,
      options: ["0", "1", "2", "3+"],
      points: 8,
    },
    {
      id: "away-goals",
      prompt: `${awayTeamName} kaç gol atar?`,
      options: ["0", "1", "2", "3+"],
      points: 8,
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
      points: 7,
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
    id: "home-win-nil",
    prompt: "Ev sahibi gol yemeden kazanır mı?",
    options: ["Evet", "Hayır"],
    points: 9,
  },
  {
    id: "away-win-nil",
    prompt: "Deplasman gol yemeden kazanır mı?",
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
    id: "three-plus-diff",
    prompt: "3 veya daha fazla gol farkıyla biter mi?",
    options: ["Evet", "Hayır"],
    points: 9,
  },
  {
    id: "home-three-plus",
    prompt: "Ev sahibi 3 veya daha fazla gol atar mı?",
    options: ["Atar", "Atmaz"],
    points: 9,
  },
  {
    id: "away-three-plus",
    prompt: "Deplasman 3 veya daha fazla gol atar mı?",
    options: ["Atar", "Atmaz"],
    points: 9,
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
  // API-Football soruları
  {
    id: "yellow-cards",
    prompt: "Toplam sarı kart sayısı?",
    options: ["0-1", "2-3", "4-5", "6+"],
    points: 8,
  },
  {
    id: "both-teams-carded",
    prompt: "Her iki takımdan da sarı kart çıkar mı?",
    options: ["Evet", "Hayır"],
    points: 7,
  },
  {
    id: "red-card-in-match",
    prompt: "Maçta kırmızı kart çıkar mı?",
    options: ["Evet", "Hayır"],
    points: 9,
  },
  {
    id: "corners-winner",
    prompt: "Hangi takım daha fazla köşe vuruşu kullanır?",
    options: [], // buildMatchQuestions tarafından takım adlarıyla doldurulur
    points: 8,
  },
  {
    id: "total-corners",
    prompt: "Toplam köşe vuruşu sayısı?",
    options: ["0-4", "5-8", "9-12", "13+"],
    points: 9,
  },
];

// --- Ana fonksiyon ---

export function buildMatchQuestions(
  matchId: string,
  homeTeamName: string,
  awayTeamName: string,
): MatchQuestion[] {
  const classic = buildClassicQuestions(homeTeamName, awayTeamName);
  const poolPicks = pickFromPool(matchId, QUESTION_POOL, 3).map((q) => {
    if (q.id === "corners-winner") {
      return { ...q, options: [homeTeamName, awayTeamName, "Eşit"] };
    }
    return q;
  });
  const multiplier = isTurkeyMatch(homeTeamName, awayTeamName) ? 2 : 1;
  return applyMultiplier([...classic, ...poolPicks], multiplier);
}
