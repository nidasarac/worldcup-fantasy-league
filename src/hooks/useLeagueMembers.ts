import { useEffect, useState } from "react";

import { getLeagueMembers } from "../services/leagues";
import { LeagueMember } from "../types/firestore";

type LeagueMemberWithId = LeagueMember & { id: string };

export function useLeagueMembers(leagueId?: string, refreshKey = 0) {
  const [members, setMembers] = useState<LeagueMemberWithId[]>([]);
  const [loading, setLoading] = useState(Boolean(leagueId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!leagueId) {
      setMembers([]);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    getLeagueMembers(leagueId)
      .then((nextMembers) => {
        if (!active) {
          return;
        }

        // Rank'i canlı olarak totalPoints'e göre hesapla (Firestore'daki rank stale olabilir)
        const sortedMembers = [...nextMembers]
          .sort((a, b) => b.totalPoints - a.totalPoints || a.displayName.localeCompare(b.displayName))
          .map((m, i) => ({ ...m, rank: i + 1 }));

        setMembers(sortedMembers);
      })
      .catch((nextError) => {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Lig üyeleri yüklenemedi.",
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

  return { members, loading, error };
}
