import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

import { getConfigError, getPublicRuntimeEnv, getSetupDiagnostics } from "@/lib/config/env";

let cachedApp: FirebaseApp | null = null;
let cachedError: string | null = null;

function buildConfig() {
  const env = getPublicRuntimeEnv();

  // Fix for third-party cookie blocking on signInWithRedirect:
  // Force the authDomain to the current host so Firebase uses a first-party iframe.
  // Next.js handles the proxy via rewrites in next.config.ts.
  const dynamicAuthDomain = typeof window !== "undefined" 
    ? window.location.host 
    : env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: dynamicAuthDomain,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

function initIfNeeded() {
  if (cachedApp || cachedError) {
    return;
  }

  const setup = getSetupDiagnostics();
  if (!setup.isReadyForLiveAuth) {
    cachedError = `${setup.issues.join(
      " | ",
    )} Add values in .env.local and restart the dev server.`;
    return;
  }

  const envError = getConfigError("firebase");
  if (envError) {
    cachedError = `${envError} Add values in .env.local and restart the dev server.`;
    return;
  }

  const config = buildConfig();
  try {
    cachedApp = getApps().length ? getApp() : initializeApp(config);

    // ── Firebase App Check (Phase 1.4) ────────────────────────────────────
    // Rejects unsigned clients before any RTDB / Functions request.
    // Only initializes when running in a browser and a site key is configured.
    if (typeof window !== "undefined") {
      const siteKey = getPublicRuntimeEnv().NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY?.trim();
      if (process.env.NODE_ENV !== "production" && !siteKey) {
        // Allow debug token in local dev so emulators still work
        // @ts-expect-error firebase debug token global
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      if (siteKey || process.env.NODE_ENV !== "production") {
        try {
          initializeAppCheck(cachedApp, {
            provider: new ReCaptchaEnterpriseProvider(
              siteKey ?? "debug-placeholder",
            ),
            isTokenAutoRefreshEnabled: true,
          });
        } catch {
          // App Check already initialized (e.g., HMR in dev) — ignore
        }
      }
    }
  } catch (error) {
    cachedError =
      error instanceof Error
        ? `Firebase initialization failed: ${error.message}`
        : "Firebase initialization failed due to an unknown error.";
  }
}

export function getFirebaseClientApp(): FirebaseApp | null {
  initIfNeeded();
  return cachedApp;
}

export function getFirebaseClientError(): string | null {
  initIfNeeded();
  return cachedError;
}

export function isFirebaseClientReady(): boolean {
  initIfNeeded();
  return Boolean(cachedApp) && !cachedError;
}
