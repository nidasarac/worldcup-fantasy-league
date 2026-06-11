import { useEffect, useRef } from "react";

import { fetchMatchStats } from "../api/apiFootball";
import {
  getDisplayTeam,
  getStadiumTimeZone,
  WorldCupData,
} from "../api/worldCup";
import { getMatchResult, setMatchResult } from "../services/matches";
import { buildMatchResultFromGame, settleMatchPredictions } from "../services/scoring";
import { syncMatchQuestionsByAdmin } from "../services/admin";

// worldcup26.ir'dan finished:"TRUE" geldiği anda ilk settlement tetiklenir.
// İlk detection'dan bu kadar ms sonra istatistikler kesinleşmiş kabul edilip re-grade yapılır.
const REGRADE_DELAY_MS = 30 * 60 * 1000; // 30 dakika

export function useAutoSettle(worldCupData: WorldCupData | null) {
  // matchId → ilk "finished: TRUE" tespit zamanı (ms)
  const firstDetectedAtRef = useRef<Record<string, number>>({});
  const firstSettledRef = useRef<Set<string>>(new Set());
  const regradeRef = useRef<Set<string>>(new Set());
  const runningRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!worldCupData) return;

    const now = Date.now();

    const finishedGames = worldCupData.games.filter(
      (game) => game.finished === "TRUE" && game.source !== "manual-test",
    );

    finishedGames.forEach(async (game) => {
      // İlk kez "finished" görüldüğünde zamanı kaydet
      if (!firstDetectedAtRef.current[game.id]) {
        firstDetectedAtRef.current[game.id] = now;
      }

      const detectedAt = firstDetectedAtRef.current[game.id];
      const msSinceDetected = now - detectedAt;

      const needsFirst = !firstSettledRef.current.has(game.id);
      const needsRegrade =
        msSinceDetected >= REGRADE_DELAY_MS && !regradeRef.current.has(game.id);

      if (!needsFirst && !needsRegrade) return;
      if (runningRef.current.has(game.id)) return;

      runningRef.current.add(game.id);

      try {
        const { teamMap } = worldCupData;
        const homeDisplay = getDisplayTeam(game, "home", teamMap);
        const awayDisplay = getDisplayTeam(game, "away", teamMap);
        const homeNameEn = teamMap[game.home_team_id]?.name_en ?? homeDisplay.name;
        const awayNameEn = teamMap[game.away_team_id]?.name_en ?? awayDisplay.name;
        const stadiumTz = getStadiumTimeZone(game.stadium_id);

        const stats = await fetchMatchStats(homeNameEn, awayNameEn, game.local_date, stadiumTz);

        if (needsFirst) {
          const existingResult = await getMatchResult(game.id);

          if (!existingResult) {
            const result = buildMatchResultFromGame(
              game,
              homeDisplay.name,
              awayDisplay.name,
              stats,
            );
            await setMatchResult(game.id, result);
            await syncMatchQuestionsByAdmin({ game, worldCupData });
            await settleMatchPredictions({
              matchId: game.id,
              matchResult: result,
              homeTeamName: homeDisplay.name,
              awayTeamName: awayDisplay.name,
              regrade: false,
            });
          }

          firstSettledRef.current.add(game.id);
        }

        // 30 dk sonra: güncel istatistiklerle tüm tahminleri yeniden puanla
        if (needsRegrade) {
          const result = buildMatchResultFromGame(
            game,
            homeDisplay.name,
            awayDisplay.name,
            stats,
          );
          await setMatchResult(game.id, result);
          await settleMatchPredictions({
            matchId: game.id,
            matchResult: result,
            homeTeamName: homeDisplay.name,
            awayTeamName: awayDisplay.name,
            regrade: true,
          });
          regradeRef.current.add(game.id);
        }
      } catch {
        // Hata durumunda bir sonraki worldCupData yenilemesinde tekrar denenecek
        runningRef.current.delete(game.id);
        return;
      }

      runningRef.current.delete(game.id);
    });
  }, [worldCupData]);
}
