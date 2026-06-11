import { DateTime } from "luxon";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { getFirebaseDb, isFirebaseConfigured } from "../lib/firebase";

const API_BASE_URL = "https://worldcup26.ir";
const TURKEY_TIME_ZONE = "Europe/Istanbul";
const FETCH_TIMEOUT_MS = 10_000;

const STADIUM_TIME_ZONES: Record<string, string> = {
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

async function fetchManualTestGames(): Promise<ApiGame[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  try {
    const db = getFirebaseDb();
    const snapshot = await getDocs(
      query(
        collection(db, "matches"),
        where("source", "==", "manual-test"),
      ),
    );

    return snapshot.docs
      .filter((item) => {
        const data = item.data() as FirestoreTestMatch;
        return data.testState === "active";
      })
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

export type WorldCupData = {
  games: ApiGame[];
  groups: ApiGroup[];
  teams: ApiTeam[];
  stadiums: ApiStadium[];
  teamMap: Record<string, ApiTeam>;
  stadiumMap: Record<string, ApiStadium>;
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal });

  if (!response.ok) {
    throw new Error(`API isteği başarısız: ${path} (${response.status})`);
  }

  const data = await response.json();
  if (data == null) {
    throw new Error(`API boş yanıt döndü: ${path}`);
  }
  return data as T;
}

export async function fetchWorldCupData(): Promise<WorldCupData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const [gamesRes, groupsRes, teamsRes, stadiumsRes, manualTestGames] = await Promise.all([
      getJson<{ games?: ApiGame[] }>("/get/games", controller.signal),
      getJson<{ groups?: ApiGroup[] }>("/get/groups", controller.signal),
      getJson<{ teams?: ApiTeam[] }>("/get/teams", controller.signal),
      getJson<{ stadiums?: ApiStadium[] }>("/get/stadiums", controller.signal),
      fetchManualTestGames(),
    ]);

    const apiGames = Array.isArray(gamesRes?.games) ? gamesRes.games : [];
    const groups = Array.isArray(groupsRes?.groups) ? groupsRes.groups : [];
    const teams = Array.isArray(teamsRes?.teams) ? teamsRes.teams : [];
    const stadiums = Array.isArray(stadiumsRes?.stadiums) ? stadiumsRes.stadiums : [];
    const games = [...apiGames, ...manualTestGames];

    return {
      games,
      groups,
      teams,
      stadiums,
      teamMap: Object.fromEntries(teams.map((t) => [t.id, t])),
      stadiumMap: Object.fromEntries(stadiums.map((s) => [s.id, s])),
    };
  } finally {
    clearTimeout(timer);
  }
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

  if (!hostDateTime.isValid) {
    return null;
  }

  return hostDateTime.setZone(TURKEY_TIME_ZONE).setLocale("tr");
}

export function getTurkeyDateKey(game: ApiGame) {
  return getTurkeyDateTime(game)?.toFormat("yyyy-MM-dd") ?? "";
}

export function formatTurkeyMatchTime(game: ApiGame) {
  const dateTime = getTurkeyDateTime(game);
  return dateTime?.toFormat("HH:mm") ?? "--:--";
}

export function formatTurkeyMatchLabel(game: ApiGame) {
  const dateTime = getTurkeyDateTime(game);
  return dateTime?.toFormat("dd MMM · HH:mm") ?? game.local_date ?? "--";
}

export function formatTurkeyDateChip(dateKey: string) {
  const dt = DateTime.fromISO(dateKey, {
    zone: TURKEY_TIME_ZONE,
    locale: "tr",
  });

  if (!dt.isValid) return dateKey;

  const today = DateTime.now().setZone(TURKEY_TIME_ZONE);

  if (dt.hasSame(today, "day")) return "Bugün";
  if (dt.hasSame(today.plus({ days: 1 }), "day")) return "Yarın";
  if (dt.hasSame(today.minus({ days: 1 }), "day")) return "Dün";

  return dt.toFormat("dd MMM");
}

export function formatTurkeyDateLong(dateKey: string) {
  const dt = DateTime.fromISO(dateKey, {
    zone: TURKEY_TIME_ZONE,
    locale: "tr",
  });

  if (!dt.isValid) return dateKey;

  const today = DateTime.now().setZone(TURKEY_TIME_ZONE);

  if (dt.hasSame(today, "day")) return "Bugün";
  if (dt.hasSame(today.plus({ days: 1 }), "day")) return "Yarın";
  if (dt.hasSame(today.minus({ days: 1 }), "day")) return "Dün";

  return dt.toFormat("d MMMM yyyy, cccc");
}

export function formatTurkeyMonthLabel(monthKey: string) {
  const dt = DateTime.fromISO(`${monthKey}-01`, {
    zone: TURKEY_TIME_ZONE,
    locale: "tr",
  });

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
  if (game.finished === "TRUE") {
    return "Tamamlandı";
  }

  if (game.time_elapsed && game.time_elapsed !== "notstarted") {
    return `${game.time_elapsed}. dk`;
  }

  const date = getTurkeyDateTime(game);

  if (!date) {
    return "Planlandı";
  }

  const diff = date.toMillis() - DateTime.now().setZone(TURKEY_TIME_ZONE).toMillis();

  if (diff <= 0) {
    return "Başlamak üzere";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) {
    return "Son 1 saat";
  }

  if (hours < 24) {
    return `${hours} saat kaldı`;
  }

  return "Yaklaşıyor";
}

export function getDisplayTeam(
  game: ApiGame,
  side: "home" | "away",
  teamMap: Record<string, ApiTeam>,
) {
  if (!game) return { name: "TBD", flag: "" };

  const teamId = side === "home" ? game.home_team_id : game.away_team_id;
  const fallbackLabel =
    side === "home" ? game.home_team_label : game.away_team_label;
  const team = teamId ? teamMap[teamId] : undefined;

  if (team) {
    return {
      name: TEAM_NAME_TR_MAP[team.name_en] ?? team.name_en,
      flag: team.flag ?? "",
    };
  }

  return {
    name: fallbackLabel || "TBD",
    flag: "",
  };
}
