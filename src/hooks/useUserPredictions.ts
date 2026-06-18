import { useEffect, useState } from "react";

import { listUserPredictions } from "../services/predictions";
import { Prediction } from "../types/firestore";

export function useUserPredictions(userId?: string, refreshKey?: number) {
  const [predictions, setPredictions] = useState<Array<Prediction & { id: string }>>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setPredictions([]);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError(null);

    listUserPredictions(userId)
      .then((items) => {
        if (active) {
          setPredictions(items);
        }
      })
      .catch((nextError) => {
        if (active) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Tahminlerin yüklenemedi.",
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
  }, [userId, refreshKey]);

  return { predictions, loading, error };
}
