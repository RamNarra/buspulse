"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";

import { getDataSourceMode } from "@/lib/config/data-source";
import { getFirebaseClientError } from "@/lib/firebase/client";
import {
  getCurrentAuthUser,
  isAllowedEmail,
  signInWithGoogle,
  signOutCurrentUser,
  subscribeToAuthUser,
} from "@/lib/firebase/auth";

export function useAuthSession() {
  const mode = getDataSourceMode();
  const [isLoading, setIsLoading] = useState(mode === "live");
  const [user, setUser] = useState<User | null>(() =>
    mode === "live" ? getCurrentAuthUser() : null,
  );
  const [error, setError] = useState<string | null>(() =>
    mode === "mock" ? getFirebaseClientError() : null,
  );

  useEffect(() => {
    if (mode !== "live") {
      return;
    }

    const unsubscribe = subscribeToAuthUser(async (nextUser) => {
      if (nextUser?.email && !isAllowedEmail(nextUser.email)) {
        await signOutCurrentUser();
        setUser(null);
        setError("Signed out: this email account is not allowed for this college.");
        setIsLoading(false);
        return;
      }

      setUser(nextUser);
      setError(null);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [mode]);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await signInWithGoogle();
    if (result.ok) {
      setUser(result.user ?? null);
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    const result = await signOutCurrentUser();
    if (!result.ok) {
      setError(result.error);
      return result;
    }

    setUser(null);
    setError(null);
    return result;
  }, []);

  return {
    mode,
    isLoading,
    user,
    error,
    signIn,
    signOut,
  };
}
