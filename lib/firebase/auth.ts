import {
  GoogleAuthProvider,
  onAuthStateChanged,
  getAuth,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";

import { getAllowedCollegeDomains } from "@/lib/config/env";
import { getFirebaseClientApp, getFirebaseClientError } from "@/lib/firebase/client";

type AuthResult =
  | { ok: true; credential?: UserCredential; user?: User }
  | { ok: false; error: string; code?: string };

function getAuthErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value : undefined;
}

function getUserFriendlyAuthError(error: unknown): { message: string; code?: string } {
  const code = getAuthErrorCode(error);

  switch (code) {
    case "auth/network-request-failed":
      return {
        code,
        message: "Network issue while contacting Firebase. Check your connection and retry.",
      };
    case "auth/unauthorized-domain":
      return {
        code,
        message: "This domain is not authorized for Firebase sign-in yet.",
      };
    case "auth/invalid-api-key":
      return {
        code,
        message: "Firebase API key is invalid for this project configuration.",
      };
    default:
      return {
        code,
        message:
          error instanceof Error
            ? error.message
            : "Google sign-in failed unexpectedly.",
      };
  }
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseClientApp();
  if (!app) {
    return null;
  }

  return getAuth(app);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Custom overrides for BusPulse deployment
  if (normalizedEmail === "ramcharannarra8@gmail.com") return true;
  if (normalizedEmail.endsWith("sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("cse.sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("ece.sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("it.sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("eee.sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("ce.sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("me.sreenidhi.edu.in")) return true;
  if (normalizedEmail.endsWith("aiml.sreenidhi.edu.in")) return true;




  const allowlist = getAllowedCollegeDomains()
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return true;
  }

  if (allowlist.includes(normalizedEmail)) {
    return true;
  }

  const domain = normalizedEmail.split("@")[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  const normalizedDomain = domain === "googlemail.com" ? "gmail.com" : domain;
  return allowlist.includes(domain) || allowlist.includes(normalizedDomain);
}

export function getCurrentAuthUser(): User | null {
  const auth = getFirebaseAuth();
  return auth?.currentUser ?? null;
}

export function subscribeToAuthUser(
  onUser: (user: User | null) => void,
): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    return () => {
      return;
    };
  }

  return onAuthStateChanged(auth, onUser);
}

export async function checkRedirectResult(): Promise<AuthResult | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  try {
    const credential = await getRedirectResult(auth);
    if (credential && credential.user) {
      if (!isAllowedEmail(credential.user.email)) {
        await signOut(auth);
        return {
          ok: false,
          error: "This email account is not allowed for this college.",
        };
      }
      return { ok: true, credential, user: credential.user };
    }
    return null; // No redirect result
  } catch (error) {
    const parsed = getUserFriendlyAuthError(error);
    return {
      ok: false,
      code: parsed.code,
      error: parsed.message,
    };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const auth = getFirebaseAuth();

  if (!auth) {
    return {
      ok: false,
      error:
        getFirebaseClientError() ??
        "Firebase auth is not configured. Add env values and restart the app.",
    };
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithRedirect(auth, provider);
    return { ok: true }; // We will redirect, so this doesn't matter much.
  } catch (error) {
    const parsed = getUserFriendlyAuthError(error);

    return {
      ok: false,
      code: parsed.code,
      error: parsed.message,
    };
  }
}

export async function signOutCurrentUser(): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      ok: false,
      error:
        getFirebaseClientError() ??
        "Firebase auth is not configured. Add env values and restart the app.",
    };
  }

  try {
    await signOut(auth);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sign out failed unexpectedly.",
    };
  }
}
