import { useEffect, useState } from "react";

import { getCurrentUserProfile } from "../services/auth";
import { AppUser } from "../types/firestore";

export function useUserProfile(uid?: string) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    if (!uid) {
      setProfile(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);

    getCurrentUserProfile(uid)
      .then((nextProfile) => {
        if (active) {
          setProfile(nextProfile);
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
  }, [refreshKey, uid]);

  return {
    profile,
    loading,
    refresh: () => setRefreshKey((current) => current + 1),
  };
}
