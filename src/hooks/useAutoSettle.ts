import { useEffect, useRef } from "react";

import { WorldCupData } from "../api/worldCup";
import { getAdminMatchStatus, settleMatchByAdmin } from "../services/admin";

export function useAutoSettle(
  worldCupData: WorldCupData | null,
  onSettled?: () => void,
) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!worldCupData) return;
    if (runningRef.current) return;

    const finishedGames = worldCupData.games.filter(
      (game) => game.finished === "TRUE" && game.source !== "manual-test",
    );

    if (finishedGames.length === 0) return;

    let cancelled = false;
    runningRef.current = true;

    (async () => {
      let anySettled = false;

      for (const game of finishedGames) {
        if (cancelled) break;

        try {
          const status = await getAdminMatchStatus(game.id);
          const needsWork =
            !status.hasResult ||
            status.questionCount === 0 ||
            status.pendingPredictionCount > 0;

          if (needsWork) {
            await settleMatchByAdmin({ game, worldCupData });
            anySettled = true;
          }
        } catch (err) {
          console.error(`[autoSettle] HATA — ${game.id}:`, err);
        }
      }

      runningRef.current = false;

      if (anySettled && !cancelled) {
        onSettled?.();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [worldCupData]);
}
