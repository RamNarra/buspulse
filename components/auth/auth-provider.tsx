"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

import { getFirebaseAuth, checkRedirectResult, isAllowedEmail, signOutCurrentUser } from "@/lib/firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Firebase not configured");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // 1. First, set up the auth state listener to catch rapid cached logins
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[Auth] onAuthStateChanged fired. User:", firebaseUser?.uid);
      
      if (firebaseUser) {
        if (!isAllowedEmail(firebaseUser.email)) {
          console.warn("[Auth] Email not allowed:", firebaseUser.email);
          await signOutCurrentUser();
          if (isMounted) {
            setUser(null);
            setError("Signed out: this email account is not allowed for this college.");
            setIsLoading(false);
          }
          return;
        }
        
        if (isMounted) {
          setUser(firebaseUser);
          setError(null);
          setIsLoading(false);
        }
      } else {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    // 2. Also check redirect result to catch errors during the redirect flow
    console.log("[Auth] Checking redirect result...");
    checkRedirectResult()
      .then((result) => {
        if (!isMounted) return;
        
        if (result === null) {
          console.log("[Auth] No redirect result found.");
        } else if (result.ok) {
          console.log("[Auth] Redirect result OK. User:", result.user?.uid);
          // onAuthStateChanged will handle setting the user
        } else {
          console.error("[Auth] Redirect result Error:", result.error);
          setError(result.error);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("[Auth] Exception during redirect check:", err);
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Automatic routing enforcement based on auth state
  useEffect(() => {
    if (isLoading) return;

    const isAuthRoute = pathname === "/login";

    if (user && isAuthRoute) {
      console.log("[Auth] User is authenticated on /login. Redirecting to /dashboard");
      router.replace("/dashboard");
    } else if (!user && !isAuthRoute && pathname !== "/") {
      console.log("[Auth] Unauthenticated user trying to access protected route. Redirecting to /login");
      router.replace("/login");
    }
  }, [user, isLoading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
