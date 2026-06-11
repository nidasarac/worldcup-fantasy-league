import Constants from "expo-constants";
import { DateTime } from "luxon";

const RAPIDAPI_KEY: string = Constants.expoConfig?.extra?.apiFootballKey ?? "";
const BASE_URL = "https://api-football-v1.p.rapidapi.com/v3";
const WORLD_CUP_LEAGUE_ID = 1;
const WORLD_CUP_SEASON = 2026;

// worldcup26.ir ile API-Football arasındaki takım adı farklılıkları
const TEAM_NAME_ALIASES: Record<string, string[]> = {
  usa: ["united states"],
  "united states": ["usa"],
  "ivory coast": ["cote d'ivoire", "cotedivoire"],
  "dr congo": ["congo dr", "democratic republic of congo"],
  "south korea": ["korea republic", "korea rep"],
  saudi: ["saudi arabia"],
  turkiye: ["turkey"],
};

function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function teamsMatch(wcName: string, apiName: string): boolean {
  const wc = normalizeForMatch(wcName);
  const api = normalizeForMatch(apiName);
  if (wc === api || wc.includes(api) || api.includes(wc)) return true;
  const aliases = TEAM_NAME_ALIASES[wc] ?? [];
  return aliases.some((alias) => {
    const n = normalizeForMatch(alias);
    return n === api || api.includes(n) || n.includes(api);
  });
}

export type MatchStats = {
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  homeCorners: number;
  awayCorners: number;
  halfTimeHomeGoals: number;
  halfTimeAwayGoals: number;
  fixtureId: number;
};

type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
};

type TeamStatEntry = {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: number | string | null }>;
};

async function apiFetch<T>(path: string): Promise<T | null> {
  if (!RAPIDAPI_KEY) return null;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": "api-football-v1.p.rapidapi.com",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { response: T };
  return data.response;
}

function getStat(stats: TeamStatEntry["statistics"], type: string): number {
  const entry = stats.find((s) => s.type === type);
  return typeof entry?.value === "number" ? entry.value : 0;
}

export function isApiFootballConfigured(): boolean {
  return Boolean(Constants.expoConfig?.extra?.apiFootballKey);
}

export async function fetchMatchStats(
  homeTeamNameEn: string,
  awayTeamNameEn: string,
  localDate: string,       // "MM/dd/yyyy HH:mm" stadyum yerel saatiyle
  stadiumTimeZone: string,
): Promise<MatchStats | null> {
  const localDt = DateTime.fromFormat(localDate, "MM/dd/yyyy HH:mm", {
    zone: stadiumTimeZone,
  });

  if (!localDt.isValid) throw new Error("Geçersiz maç tarihi formatı.");

  const utcDate = localDt.toUTC().toFormat("yyyy-MM-dd");
  // Gece yarısına yakın maçlar için bir önceki UTC gününü de dene
  const prevDate = localDt.toUTC().minus({ days: 1 }).toFormat("yyyy-MM-dd");

  for (const date of [utcDate, prevDate]) {
    const fixtures = await apiFetch<ApiFixture[]>(
      `/fixtures?league=${WORLD_CUP_LEAGUE_ID}&season=${WORLD_CUP_SEASON}&date=${date}`,
    );

    if (!fixtures) return null;

    const fixture = fixtures.find(
      (f) =>
        teamsMatch(homeTeamNameEn, f.teams.home.name) &&
        teamsMatch(awayTeamNameEn, f.teams.away.name),
    );

    if (!fixture) continue;

    const teamStats = await apiFetch<TeamStatEntry[]>(
      `/fixtures/statistics?fixture=${fixture.fixture.id}`,
    );

    if (!teamStats || teamStats.length < 2) return null;

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
      halfTimeHomeGoals: fixture.score.halftime.home ?? 0,
      halfTimeAwayGoals: fixture.score.halftime.away ?? 0,
      fixtureId: fixture.fixture.id,
    };
  }

  return null;
}
