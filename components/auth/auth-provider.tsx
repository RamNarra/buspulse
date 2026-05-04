"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { useRouter, usePathname } from "next/navigation";
import { getFirebaseClientApp } from "@/lib/firebase/client";

/** Randomly generated session token for this browser tab / device. */
function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

  // Stable token for this browser instance
  const sessionTokenRef = useRef<string>(generateSessionToken());

  // Kick the user out if another device logs in
  const kickSelf = useCallback(
    async (auth: ReturnType<typeof getAuth>) => {
      console.warn("[AuthProvider] Session invalidated by another device. Signing out.");
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Sign out failed", e);
      }
      setTimeout(() => {
        window.location.href = "/login";
      }, 100);
    },
    [],
  );

  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) {
      setIsLoading(false);
      return;
    }

    const auth = getAuth(app);
    const db = getFirestore(app);
    let sessionUnsub: (() => void) | null = null;

    // ── Register this session in Firestore ─────────────────────────────────
    async function registerSession(uid: string) {
      const token = sessionTokenRef.current;
      const sessionRef = doc(db, "sessions", uid);
      try {
        await setDoc(sessionRef, { token, uid, ts: Date.now() });

        // Watch for another device overwriting this token
        sessionUnsub = onSnapshot(sessionRef, (snap) => {
          if (!snap.exists()) return;
          const remote = snap.data() as { token?: string };
          if (remote.token && remote.token !== token) {
            void kickSelf(auth);
          }
        });
      } catch (err) {
        console.error("[AuthProvider] Failed to register session:", err);
      }
    }

    async function clearSession(uid: string) {
      const sessionRef = doc(db, "sessions", uid);
      try {
        await deleteDoc(sessionRef);
      } catch {
        // Best-effort
      }
    }

    // ── Process pending redirect first ─────────────────────────────────────
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("[AuthProvider] getRedirectResult SUCCESS:", result.user.uid);
        } else {
          console.log("[AuthProvider] getRedirectResult NO RESULT");
        }
      })
      .catch((err) => {
        console.error("[AuthProvider] REDIRECT ERROR:", err.code, err.message);
      });

    // ── Auth state listener ────────────────────────────────────────────────
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      console.log(
        "[AuthProvider] onAuthStateChanged:",
        firebaseUser ? firebaseUser.uid : "null",
      );

      // Tear down previous session watcher when user changes
      if (sessionUnsub) {
        sessionUnsub();
        sessionUnsub = null;
      }

      setUser(firebaseUser);
      setIsLoading(false);

      if (firebaseUser) {
        void registerSession(firebaseUser.uid);
        if (pathname === "/login" || pathname === "/") {
          router.push("/dashboard");
        }
      } else {
        if (pathname !== "/login" && pathname !== "/") {
          router.push("/login");
        }
      }
    });

    return () => {
      unsubAuth();
      if (sessionUnsub) sessionUnsub();
      // Clean up session on tab close if user is still logged in
      if (auth.currentUser) {
        void clearSession(auth.currentUser.uid);
      }
    };
    // pathname intentionally not in deps — we only want the initial nav effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickSelf, router]);

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
