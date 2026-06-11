import { onAuthStateChanged, User } from "firebase/auth";
import { useEffect, useState } from "react";

import { getFirebaseAuth, isFirebaseConfigured } from "../lib/firebase";

export function useAuthSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return {
    user,
    loading,
    isConfigured: isFirebaseConfigured(),
  };
}
