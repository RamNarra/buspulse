import {
  GoogleAuthProvider,
  onAuthStateChanged,
  getAuth,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";

import { getAllowedCollegeDomains } from "@/lib/config/env";
import { getFirebaseClientApp, getFirebaseClientError } from "@/lib/firebase/client";

type AuthResult =
  | { ok: true; credential: UserCredential; user: User }
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
    case "auth/popup-blocked":
      return {
        code,
        message:
          "Sign-in popup was blocked by your browser. Allow popups for this site and try again.",
      };
    case "auth/popup-closed-by-user":
      return {
        code,
        message: "Sign-in popup was closed before completion. Please try again.",
      };
    case "auth/cancelled-popup-request":
      return {
        code,
        message: "Another sign-in request is already in progress. Please try again.",
      };
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

  const domains = getAllowedCollegeDomains();
  if (domains.length === 0) {
    return true;
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  return domains.includes(domain);
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
    const credential = await signInWithPopup(auth, provider);
    if (!isAllowedEmail(credential.user.email)) {
      await signOut(auth);
      return {
        ok: false,
        error: "This email domain is not allowed for this college account.",
      };
    }

    return { ok: true, credential, user: credential.user };
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
