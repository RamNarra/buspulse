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
  | { ok: false; error: string };

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
        error:
          "This account is not in an allowed college domain. Update NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS.",
      };
    }

    return { ok: true, credential, user: credential.user };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Google sign-in failed unexpectedly.",
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
