import { useEffect, useState } from "react";

import { getLeagueById } from "../services/leagues";
import { League } from "../types/firestore";

export function useLeague(leagueId?: string, refreshKey = 0) {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(Boolean(leagueId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!leagueId) {
      setLeague(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    getLeagueById(leagueId)
      .then((nextLeague) => {
        if (active) {
          setLeague(nextLeague);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Lig bilgisi alınamadı.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [leagueId, refreshKey]);

  return { league, loading, error };
}
