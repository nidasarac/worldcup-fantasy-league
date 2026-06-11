export type MatchQuestion = {
  id: string;
  prompt: string;
  options: string[];
  defaultSelection: string;
  insight: string;
};

export type FeaturedMatch = {
  id: string;
  stage: string;
  kickoff: string;
  groupLabel: string;
  venue: string;
  crowd: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  jackpot: string;
  questions: MatchQuestion[];
};

export type Fixture = {
  id: string;
  dayLabel: string;
  kickoff: string;
  stage: string;
  venue: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  status: string;
  questions: number;
};

export type Leader = {
  id: string;
  name: string;
  handle: string;
  points: number;
  perfectHits: number;
  streak: string;
  badge: string;
};

export const featuredMatch: FeaturedMatch = {
  id: "usa-bra",
  stage: "Gunün Buyuk Maci",
  kickoff: "Persembe 22:00",
  groupLabel: "World Cup 26 - Yari Final",
  venue: "MetLife Stadium",
  crowd: "49.383 oyuncu bu maca tahmin girdi",
  homeTeam: "Amerika",
  awayTeam: "Brezilya",
  homeFlag: "🇺🇸",
  awayFlag: "🇧🇷",
  jackpot: "Kazanan bonusu 180 puan",
  questions: [
    {
      id: "winner",
      prompt: "Kim kazanir?",
      options: ["Amerika", "Beraberlik", "Brezilya"],
      defaultSelection: "Brezilya",
      insight: "14.804 kisi sizinle ayni tahminde bulundu.",
    },
    {
      id: "home-goals",
      prompt: "Amerika kac gol atar?",
      options: ["0", "1", "2", "3+"],
      defaultSelection: "1",
      insight: "10.291 kisi bu secenegi isaretledi.",
    },
    {
      id: "away-goals",
      prompt: "Brezilya kac gol atar?",
      options: ["0", "1", "2", "3+"],
      defaultSelection: "2",
      insight: "15.927 kisi sizinle ayni tahminde bulundu.",
    },
    {
      id: "first-half",
      prompt: "Ilk yari kac gol olur?",
      options: ["Gol olmaz", "1", "2", "3+"],
      defaultSelection: "1",
      insight: "26.669 kisi sizinle ayni tahminde bulundu.",
    },
    {
      id: "first-scorer",
      prompt: "Ilk golu kim atar?",
      options: ["Pulisic", "Vinicius Jr", "Rodrygo", "Diger", "Gol olmaz"],
      defaultSelection: "Vinicius Jr",
      insight: "8.412 kisi ilk gol icin ayni oyuncuyu secti.",
    },
    {
      id: "cards",
      prompt: "Kirmizi kart olur mu?",
      options: ["Olur", "Olmaz"],
      defaultSelection: "Olmaz",
      insight: "6.743 kisi dogru secenege yoneldi.",
    },
  ],
};

export const todayFixtures: Fixture[] = [
  {
    id: "usa-bra",
    dayLabel: "Bugun",
    kickoff: "22:00",
    stage: "Yari Final",
    venue: "MetLife Stadium",
    homeTeam: "Amerika",
    awayTeam: "Brezilya",
    homeFlag: "🇺🇸",
    awayFlag: "🇧🇷",
    status: "Tahmine acik",
    questions: 6,
  },
  {
    id: "fra-arg",
    dayLabel: "Bugun",
    kickoff: "19:30",
    stage: "Yari Final",
    venue: "SoFi Stadium",
    homeTeam: "Fransa",
    awayTeam: "Arjantin",
    homeFlag: "🇫🇷",
    awayFlag: "🇦🇷",
    status: "Son 48 dakika",
    questions: 8,
  },
  {
    id: "esp-ger",
    dayLabel: "Yarin",
    kickoff: "21:00",
    stage: "3.luk Maci",
    venue: "AT&T Stadium",
    homeTeam: "Ispanya",
    awayTeam: "Almanya",
    homeFlag: "🇪🇸",
    awayFlag: "🇩🇪",
    status: "Yarin aciliyor",
    questions: 5,
  },
];

export const leaders: Leader[] = [
  {
    id: "1",
    name: "Mert Kaya",
    handle: "@mertk",
    points: 1420,
    perfectHits: 18,
    streak: "+84 bu hafta",
    badge: "Lider",
  },
  {
    id: "2",
    name: "Nida Sarac",
    handle: "@nida",
    points: 1385,
    perfectHits: 16,
    streak: "+102 bu hafta",
    badge: "Takipte",
  },
  {
    id: "3",
    name: "Ege Demir",
    handle: "@eged",
    points: 1312,
    perfectHits: 15,
    streak: "+61 bu hafta",
    badge: "Formda",
  },
  {
    id: "4",
    name: "Sena Kurt",
    handle: "@senak",
    points: 1280,
    perfectHits: 14,
    streak: "+54 bu hafta",
    badge: "Yukseliyor",
  },
];

export const profileStats = [
  { label: "Toplam Puan", value: "1.385" },
  { label: "Dogruluk", value: "%71" },
  { label: "Ligde Sira", value: "#2" },
];
