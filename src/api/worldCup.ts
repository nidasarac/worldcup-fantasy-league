import { DateTime } from "luxon";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import Constants from "expo-constants";
import { getFirebaseDb, isFirebaseConfigured } from "../lib/firebase";

const ZAFRONIX_BASE_URL = "https://api.zafronix.com/fifa/worldcup/v1";
const TURKEY_TIME_ZONE = "Europe/Istanbul";
const FETCH_TIMEOUT_MS = 10_000;

function getZafronixApiKey(): string {
  return Constants.expoConfig?.extra?.zafronixApiKey ?? "zwc_free_66f5fb7d2e78b46d0075654a";
}

const TEAM_FLAG_EMOJI_MAP: Record<string, string> = {
  Algeria: "🇩🇿", Cezayir: "🇩🇿",
  Argentina: "🇦🇷", Arjantin: "🇦🇷",
  Australia: "🇦🇺", Avustralya: "🇦🇺",
  Austria: "🇦🇹", Avusturya: "🇦🇹",
  Belgium: "🇧🇪", Belçika: "🇧🇪",
  "Bosnia and Herzegovina": "🇧🇦", "Bosna Hersek": "🇧🇦",
  Brazil: "🇧🇷", Brezilya: "🇧🇷",
  "Cabo Verde": "🇨🇻", "Cape Verde": "🇨🇻", "Yeşil Burun Adaları": "🇨🇻",
  Canada: "🇨🇦", Kanada: "🇨🇦",
  Colombia: "🇨🇴", Kolombiya: "🇨🇴",
  "Congo DR": "🇨🇩", "DR Congo": "🇨🇩", "Kongo DC": "🇨🇩",
  Croatia: "🇭🇷", Hırvatistan: "🇭🇷",
  "Curaçao": "🇨🇼", Curacao: "🇨🇼",
  Czechia: "🇨🇿", "Czech Republic": "🇨🇿", Çekya: "🇨🇿",
  "Côte d'Ivoire": "🇨🇮", "Ivory Coast": "🇨🇮", "Fildişi Sahili": "🇨🇮",
  Ecuador: "🇪🇨", Ekvador: "🇪🇨",
  Egypt: "🇪🇬", Mısır: "🇪🇬",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", İngiltere: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  France: "🇫🇷", Fransa: "🇫🇷",
  Germany: "🇩🇪", Almanya: "🇩🇪",
  Ghana: "🇬🇭", Gana: "🇬🇭",
  Haiti: "🇭🇹",
  "IR Iran": "🇮🇷", Iran: "🇮🇷", İran: "🇮🇷",
  Iraq: "🇮🇶", Irak: "🇮🇶",
  Japan: "🇯🇵", Japonya: "🇯🇵",
  Jordan: "🇯🇴", Ürdün: "🇯🇴",
  "Korea Republic": "🇰🇷", "South Korea": "🇰🇷", "Güney Kore": "🇰🇷",
  Mexico: "🇲🇽", Meksika: "🇲🇽",
  Morocco: "🇲🇦", Fas: "🇲🇦",
  Netherlands: "🇳🇱", Hollanda: "🇳🇱",
  "New Zealand": "🇳🇿", "Yeni Zelanda": "🇳🇿",
  Norway: "🇳🇴", Norveç: "🇳🇴",
  Panama: "🇵🇦",
  Paraguay: "🇵🇾",
  Portugal: "🇵🇹", Portekiz: "🇵🇹",
  Qatar: "🇶🇦", Katar: "🇶🇦",
  "Saudi Arabia": "🇸🇦", Saudi: "🇸🇦", "Suudi Arabistan": "🇸🇦",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", İskoçya: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Senegal: "🇸🇳",
  "South Africa": "🇿🇦", "Güney Afrika": "🇿🇦",
  Spain: "🇪🇸", İspanya: "🇪🇸",
  Sweden: "🇸🇪", İsveç: "🇸🇪",
  Switzerland: "🇨🇭", İsviçre: "🇨🇭",
  Tunisia: "🇹🇳", Tunus: "🇹🇳",
  "Türkiye": "🇹🇷", Turkiye: "🇹🇷", Turkey: "🇹🇷",
  USA: "🇺🇸", ABD: "🇺🇸",
  Uruguay: "🇺🇾",
  Uzbekistan: "🇺🇿", Özbekistan: "🇺🇿",
};

export function getFlagEmoji(name: string): string {
  return TEAM_FLAG_EMOJI_MAP[name] ?? "🏳️";
}

// stadium_id "0" → UTC (Zafronix maçları için kickoffUtc'yi UTC olarak saklıyoruz)
const STADIUM_TIME_ZONES: Record<string, string> = {
  "0": "UTC",
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

const TEAM_NAME_TR_MAP: Record<string, string> = {
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

// Zafronix stage → app type + group
function parseZafronixStage(stage: string | null | undefined): { type: string; group: string } {
  if (!stage) return { type: "group", group: "" };
  if (stage.startsWith("group_")) {
    return { type: "group", group: stage.replace("group_", "").toUpperCase() };
  }
  const map: Record<string, string> = {
    r32: "r32",
    r16: "r16",
    qf: "qf",
    sf: "sf",
    thirdPlace: "third",
    third_place: "third",
    final: "final",
  };
  return { type: map[stage] ?? "group", group: "" };
}

// Mevcut app'in beklediği ApiGame formatı
export type ApiGame = {
  _id: string;
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  home_scorers: string;
  away_scorers: string;
  group: string;
  matchday: string;
  local_date: string;
  persian_date: string;
  stadium_id: string;
  finished: string;
  time_elapsed: string;
  type: string;
  home_team_label?: string;
  away_team_label?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  source?: string;
  stadiumName?: string;
  stadiumCity?: string;
};

export type ApiTeam = {
  _id: string;
  id: string;
  name_en: string;
  flag: string;
};

export type ApiStadium = {
  _id: string;
  id: string;
  fifa_name: string;
  city_en: string;
  capacity: string;
  state_province: string;
};

export type ApiGroupRow = {
  _id: string;
  team_id: string;
  mp: string;
  w: string;
  d: string;
  l: string;
  gf: string;
  ga: string;
  gd: string;
  pts: string;
};

export type ApiGroup = {
  _id: string;
  id: string;
  name: string;
  teams: ApiGroupRow[];
};

type ZafronixMatch = {
  id: string;
  matchNo: number;
  kickoffUtc: string;
  stage: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
};

type FirestoreTestMatch = {
  source: "manual-test";
  testState: "active" | "archived";
  homeTeamName: string;
  awayTeamName: string;
  localDate: string;
  group?: string;
  matchday?: string;
  stage?: string;
  stadiumId?: string;
  testFinished?: boolean;
  testHomeScore?: number;
  testAwayScore?: number;
};

export type WorldCupData = {
  games: ApiGame[];
  groups: ApiGroup[];
  teams: ApiTeam[];
  stadiums: ApiStadium[];
  teamMap: Record<string, ApiTeam>;
  stadiumMap: Record<string, ApiStadium>;
};

function zafronixMatchToApiGame(match: ZafronixMatch): ApiGame {
  const { type, group } = parseZafronixStage(match.stage);
  const isFinished = match.status === "finished";

  // kickoffUtc'yi UTC zone'unda "MM/dd/yyyy HH:mm" formatına çevir
  // stadium_id "0" → UTC timezone → getTurkeyDateTime doğru çevirir
  const kickoffDt = DateTime.fromISO(match.kickoffUtc, { zone: "UTC" });
  const localDate = kickoffDt.isValid ? kickoffDt.toFormat("MM/dd/yyyy HH:mm") : "";

  return {
    _id: String(match.id),
    id: String(match.id),
    home_team_id: "",
    away_team_id: "",
    home_score: isFinished ? String(match.homeScore ?? 0) : "0",
    away_score: isFinished ? String(match.awayScore ?? 0) : "0",
    home_scorers: "",
    away_scorers: "",
    group,
    matchday: String(match.matchNo ?? ""),
    local_date: localDate,
    persian_date: "",
    stadium_id: "0",
    finished: isFinished ? "TRUE" : "FALSE",
    time_elapsed: isFinished ? "finished" : "notstarted",
    type,
    home_team_label: TEAM_NAME_TR_MAP[match.homeTeam] ?? match.homeTeam ?? "TBD",
    away_team_label: TEAM_NAME_TR_MAP[match.awayTeam] ?? match.awayTeam ?? "TBD",
    home_team_name_en: match.homeTeam,
    away_team_name_en: match.awayTeam,
    stadiumName: (match as any).stadium ?? undefined,
    stadiumCity: (match as any).city ?? undefined,
  };
}

async function fetchZafronixGames(): Promise<ApiGame[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ZAFRONIX_BASE_URL}/matches?year=2026`, {
      signal: controller.signal,
      headers: { "X-API-Key": getZafronixApiKey() },
    });
    if (!res.ok) throw new Error(`Zafronix ${res.status}`);
    const data = await res.json();
    const matches: ZafronixMatch[] = data.data ?? [];
    return matches.filter((m) => m.id && m.kickoffUtc).map(zafronixMatchToApiGame);
  } finally {
    clearTimeout(timer);
  }
}

type FirestoreMatchDoc = {
  externalMatchId: string;
  stage: string;
  group: string;
  matchday: string;
  homeTeamName: string;
  awayTeamName: string;
  stadiumName?: string;
  kickoffAt: string;
  status: "upcoming" | "open" | "locked" | "finished";
  homeScore?: number | null;
  awayScore?: number | null;
  overrideHomeScore?: number | null;
  overrideAwayScore?: number | null;
};

const FIRESTORE_STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "group",
  ROUND_OF_32: "r32",
  ROUND_OF_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  FINAL: "final",
  THIRD_PLACE: "third",
};

function firestoreMatchToApiGame(docId: string, data: FirestoreMatchDoc): ApiGame {
  const type = FIRESTORE_STAGE_MAP[data.stage] ?? "group";
  const isFinished = data.status === "finished";
  const kickoffDt = DateTime.fromISO(data.kickoffAt, { zone: "UTC" });
  const localDate = kickoffDt.isValid ? kickoffDt.toFormat("MM/dd/yyyy HH:mm") : "";

  return {
    _id: docId,
    id: docId,
    home_team_id: "",
    away_team_id: "",
    home_score: isFinished ? String(data.overrideHomeScore ?? data.homeScore ?? 0) : "0",
    away_score: isFinished ? String(data.overrideAwayScore ?? data.awayScore ?? 0) : "0",
    home_scorers: "",
    away_scorers: "",
    group: data.group ?? "",
    matchday: data.matchday ?? "",
    local_date: localDate,
    persian_date: "",
    stadium_id: "0",
    finished: isFinished ? "TRUE" : "FALSE",
    time_elapsed: isFinished ? "finished" : "notstarted",
    type,
    home_team_label: data.homeTeamName,
    away_team_label: data.awayTeamName,
    stadiumName: data.stadiumName,
  };
}

async function fetchFirestoreGames(): Promise<ApiGame[]> {
  if (!isFirebaseConfigured()) return [];
  const db = getFirebaseDb();
  const snap = await getDocs(collection(db, "matches"));
  return snap.docs
    .filter((doc) => doc.data().kickoffAt)
    .map((doc) => firestoreMatchToApiGame(doc.id, doc.data() as FirestoreMatchDoc));
}

async function fetchManualTestGames(): Promise<ApiGame[]> {
  if (!isFirebaseConfigured()) return [];

  try {
    const db = getFirebaseDb();
    const snapshot = await getDocs(
      query(collection(db, "matches"), where("source", "==", "manual-test")),
    );

    return snapshot.docs
      .filter((item) => (item.data() as FirestoreTestMatch).testState === "active")
      .map((item) => {
        const data = item.data() as FirestoreTestMatch;
        const isFinished = data.testFinished === true;
        return {
          _id: item.id,
          id: item.id,
          home_team_id: "",
          away_team_id: "",
          home_score: isFinished ? String(data.testHomeScore ?? 0) : "0",
          away_score: isFinished ? String(data.testAwayScore ?? 0) : "0",
          home_scorers: "",
          away_scorers: "",
          group: data.group ?? "TEST",
          matchday: data.matchday ?? "0",
          local_date: data.localDate,
          persian_date: "",
          stadium_id: data.stadiumId ?? "7",
          finished: isFinished ? "TRUE" : "FALSE",
          time_elapsed: isFinished ? "finished" : "notstarted",
          type: data.stage ?? "group",
          home_team_label: data.homeTeamName,
          away_team_label: data.awayTeamName,
          source: data.source,
        };
      });
  } catch {
    return [];
  }
}

function computeGroupStandings(games: ApiGame[]): ApiGroup[] {
  const groupData = new Map<string, Map<string, { mp: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }>>();

  for (const game of games) {
    if (game.type !== "group" || !game.group) continue;
    const g = game.group;
    if (!groupData.has(g)) groupData.set(g, new Map());
    const gMap = groupData.get(g)!;

    const home = game.home_team_label || "TBD";
    const away = game.away_team_label || "TBD";
    if (!gMap.has(home)) gMap.set(home, { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
    if (!gMap.has(away)) gMap.set(away, { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });

    if (game.finished !== "TRUE") continue;

    const h = parseInt(game.home_score || "0", 10);
    const a = parseInt(game.away_score || "0", 10);
    const hs = gMap.get(home)!;
    const as_ = gMap.get(away)!;

    hs.mp++; as_.mp++;
    hs.gf += h; hs.ga += a;
    as_.gf += a; as_.ga += h;

    if (h > a) { hs.w++; as_.l++; hs.pts += 3; }
    else if (a > h) { as_.w++; hs.l++; as_.pts += 3; }
    else { hs.d++; as_.d++; hs.pts += 1; as_.pts += 1; }
  }

  const result: ApiGroup[] = [];
  groupData.forEach((teamMap, groupLetter) => {
    const teams: ApiGroupRow[] = [];
    teamMap.forEach((stats, teamName) => {
      teams.push({
        _id: teamName,
        team_id: teamName,
        mp: String(stats.mp),
        w: String(stats.w),
        d: String(stats.d),
        l: String(stats.l),
        gf: String(stats.gf),
        ga: String(stats.ga),
        gd: String(stats.gf - stats.ga),
        pts: String(stats.pts),
      });
    });
    result.push({ _id: groupLetter, id: groupLetter, name: groupLetter, teams });
  });

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchWorldCupData(): Promise<WorldCupData> {
  const [firestoreResult, manualTestGames] = await Promise.allSettled([
    fetchFirestoreGames(),
    fetchManualTestGames(),
  ]);

  const manualGames = manualTestGames.status === "fulfilled" ? manualTestGames.value : [];
  let apiGames = firestoreResult.status === "fulfilled" ? firestoreResult.value : [];

  // Firestore henüz dolu değilse (ilk kurulum) Zafronix'e fallback
  if (apiGames.length === 0) {
    try {
      apiGames = await fetchZafronixGames();
    } catch {
      // fallback da başarısız olduysa devam et
    }
  }

  const games = [...apiGames, ...manualGames];

  if (games.length === 0) {
    throw new Error("Maç verisi alınamadı. Lütfen daha sonra tekrar deneyin.");
  }

  return {
    games,
    groups: computeGroupStandings(games),
    teams: [],
    stadiums: [],
    teamMap: {},
    stadiumMap: {},
  };
}

export function getStadiumTimeZone(stadiumId: string) {
  return STADIUM_TIME_ZONES[stadiumId] ?? "America/New_York";
}

export function getTurkeyDateTime(game: ApiGame) {
  if (!game?.local_date || !game?.stadium_id) return null;

  const hostDateTime = DateTime.fromFormat(game.local_date, "MM/dd/yyyy HH:mm", {
    zone: getStadiumTimeZone(game.stadium_id),
    locale: "en",
  });

  if (!hostDateTime.isValid) return null;

  return hostDateTime.setZone(TURKEY_TIME_ZONE).setLocale("tr");
}

export function getTurkeyDateKey(game: ApiGame) {
  return getTurkeyDateTime(game)?.toFormat("yyyy-MM-dd") ?? "";
}

export function formatTurkeyMatchTime(game: ApiGame) {
  return getTurkeyDateTime(game)?.toFormat("HH:mm") ?? "--:--";
}

export function formatTurkeyMatchLabel(game: ApiGame) {
  return getTurkeyDateTime(game)?.toFormat("dd MMM · HH:mm") ?? game.local_date ?? "--";
}

export function formatTurkeyDateChip(dateKey: string) {
  const dt = DateTime.fromISO(dateKey, { zone: TURKEY_TIME_ZONE, locale: "tr" });
  if (!dt.isValid) return dateKey;

  const today = DateTime.now().setZone(TURKEY_TIME_ZONE);
  if (dt.hasSame(today, "day")) return "Bugün";
  if (dt.hasSame(today.plus({ days: 1 }), "day")) return "Yarın";
  if (dt.hasSame(today.minus({ days: 1 }), "day")) return "Dün";
  return dt.toFormat("dd MMM");
}

export function formatTurkeyDateLong(dateKey: string) {
  const dt = DateTime.fromISO(dateKey, { zone: TURKEY_TIME_ZONE, locale: "tr" });
  if (!dt.isValid) return dateKey;

  const today = DateTime.now().setZone(TURKEY_TIME_ZONE);
  if (dt.hasSame(today, "day")) return "Bugün";
  if (dt.hasSame(today.plus({ days: 1 }), "day")) return "Yarın";
  if (dt.hasSame(today.minus({ days: 1 }), "day")) return "Dün";
  return dt.toFormat("d MMMM yyyy, cccc");
}

export function formatTurkeyMonthLabel(monthKey: string) {
  const dt = DateTime.fromISO(`${monthKey}-01`, { zone: TURKEY_TIME_ZONE, locale: "tr" });
  if (!dt.isValid) return monthKey;
  return dt.toFormat("MMMM yyyy");
}

export function isSameTurkeyDay(game: ApiGame, referenceDate: DateTime) {
  const dateTime = getTurkeyDateTime(game);
  return Boolean(dateTime && dateTime.hasSame(referenceDate, "day"));
}

export function getStageLabel(game: ApiGame) {
  const labels: Record<string, string> = {
    group: `Grup ${game.group ?? ""}`,
    r32: "Son 32",
    r16: "Son 16",
    qf: "Çeyrek Final",
    sf: "Yarı Final",
    third: "Üçüncülük",
    final: "Final",
  };
  return labels[game.type] ?? (game.group ? `Grup ${game.group}` : "Maç");
}

export function getGameStatus(game: ApiGame) {
  if (game.finished === "TRUE") return "Tamamlandı";

  if (game.time_elapsed && game.time_elapsed !== "notstarted") {
    return `${game.time_elapsed}. dk`;
  }

  const date = getTurkeyDateTime(game);
  if (!date) return "Planlandı";

  const diff = date.toMillis() - DateTime.now().setZone(TURKEY_TIME_ZONE).toMillis();
  if (diff <= 0) return "Başlamak üzere";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Son 1 saat";
  if (hours < 24) return `${hours} saat kaldı`;
  return "Yaklaşıyor";
}

export function getDisplayTeam(
  game: ApiGame,
  side: "home" | "away",
  teamMap: Record<string, ApiTeam>,
) {
  if (!game) return { name: "TBD", flag: "", flagEmoji: "🏳️" };

  const teamId = side === "home" ? game.home_team_id : game.away_team_id;
  const fallbackLabel = side === "home" ? game.home_team_label : game.away_team_label;
  const nameEn = side === "home" ? game.home_team_name_en : game.away_team_name_en;
  const team = teamId ? teamMap[teamId] : undefined;

  if (team) {
    const name = TEAM_NAME_TR_MAP[team.name_en] ?? team.name_en;
    return { name, flag: team.flag ?? "", flagEmoji: getFlagEmoji(team.name_en) };
  }

  const name = fallbackLabel || "TBD";
  return { name, flag: "", flagEmoji: getFlagEmoji(nameEn ?? name) };
}
