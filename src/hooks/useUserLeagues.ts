import { useEffect, useState } from "react";

import { getUserLeagues } from "../services/leagues";
import { League } from "../types/firestore";

export function useUserLeagues(userId?: string, refreshKey = 0) {
  const [leagues, setLeagues] = useState<Array<League & { id: string }>>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setLeagues([]);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    getUserLeagues(userId)
      .then((nextLeagues) => {
        if (active) {
          setLeagues(nextLeagues);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message.includes("Missing or insufficient permissions")
                ? "Liglerini görmek için Firestore erişimi tamamlanmalı."
                : nextError.message
              : "Ligler yüklenemedi.",
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
  }, [refreshKey, userId]);

  return { leagues, loading, error };
}
