"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type User, getAuth, onAuthStateChanged, getRedirectResult } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { getFirebaseClientApp } from "@/lib/firebase/client";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) {
      console.error("[AuthProvider] Firebase app not initialized");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }
    const auth = getAuth(app);

    // CRITICAL: Call getRedirectResult on mount to process any pending redirects
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("[AuthProvider] getRedirectResult SUCCESS:", result.user.uid);
        } else {
          console.log("[AuthProvider] getRedirectResult NO RESULT");
        }
      })
      .catch((error) => {
        console.error("[AuthProvider] FATAL REDIRECT ERROR:", error.code, error.message, error);
      });

    // Listen for auth state
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("[AuthProvider] onAuthStateChanged fired. User:", firebaseUser ? firebaseUser.uid : "null");
      setUser(firebaseUser);
      setIsLoading(false);

      if (firebaseUser) {
        if (pathname === "/login" || pathname === "/") {
          console.log("[AuthProvider] User detected, pushing to /dashboard");
          router.push("/dashboard");
        }
      } else {
        if (pathname !== "/login" && pathname !== "/") {
          console.log("[AuthProvider] No user, pushing to /login");
          router.push("/login");
        }
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
