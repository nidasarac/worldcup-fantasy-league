import { useEffect, useRef } from "react";

import { WorldCupData } from "../api/worldCup";
import { getAdminMatchStatus, settleMatchByAdmin } from "../services/admin";

// Admin kullanıcısının oturumu boyunca, biten her maç için bir kez çalışır.
// App.tsx'te sadece admin e-postası eşleşince çağrılır —
// Firestore kuralları matches/*/result ve questions yazmayı sadece admin'e izin verir.
export function useAutoSettle(worldCupData: WorldCupData | null) {
  const processedRef = useRef<Set<string>>(new Set());
  const runningRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!worldCupData) return;

    const finishedGames = worldCupData.games.filter(
      (game) => game.finished === "TRUE" && game.source !== "manual-test",
    );

    finishedGames.forEach(async (game) => {
      if (processedRef.current.has(game.id)) return;
      if (runningRef.current.has(game.id)) return;

      runningRef.current.add(game.id);

      try {
        const status = await getAdminMatchStatus(game.id);
        const needsWork =
          !status.hasResult ||
          status.questionCount === 0 ||
          status.pendingPredictionCount > 0 ||
          status.settledPredictionCount > 0;

        if (needsWork) {
          await settleMatchByAdmin({ game, worldCupData });
        }

        processedRef.current.add(game.id);
      } catch {
        // sessizce geç — bir sonraki worldCupData güncellemesinde tekrar denenecek
      } finally {
        runningRef.current.delete(game.id);
      }
    });
  }, [worldCupData]);
}
