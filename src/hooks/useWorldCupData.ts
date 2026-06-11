import { useEffect, useState } from "react";

import { fetchWorldCupData, WorldCupData } from "../api/worldCup";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 dakika

export function useWorldCupData() {
  const [data, setData] = useState<WorldCupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const nextData = await fetchWorldCupData();
        if (!cancelled) setData(nextData);
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Veri alınırken hata oluştu.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Her 5 dakikada bir yenile — finished durumu ve yeni sonuçlar için
  useEffect(() => {
    const interval = setInterval(
      () => setRefreshKey((k) => k + 1),
      REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, []);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { data, loading, error, refresh };
}
