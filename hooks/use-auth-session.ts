"use client";

import { useAuthContext } from "@/components/auth/auth-provider";
import { signOutCurrentUser } from "@/lib/firebase/auth";
import { useCallback } from "react";
import { getDataSourceMode } from "@/lib/config/data-source";

export function useAuthSession() {
  const context = useAuthContext();
  const mode = getDataSourceMode();

  const signOut = useCallback(async () => {
    const result = await signOutCurrentUser();
    // context will automatically update via onAuthStateChanged returning null
    return result;
  }, []);

  return {
    mode,
    isLoading: context.isLoading,
    user: context.user,
    error: null,
    signOut,
  };
}
