// Client-side Firebase Cloud Messaging initialisation.
// Called once after Firebase app is ready.
// Returns null when messaging is not supported (e.g. Safari < 16.4, SSR).

import { getMessaging, getToken, onMessage, type Messaging } from "firebase/messaging";
import type { FirebaseApp } from "firebase/app";
import { getPublicRuntimeEnv } from "@/lib/config/env";

let cachedMessaging: Messaging | null = null;

export function getFirebaseMessaging(app: FirebaseApp): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  // Messaging is not supported in all browsers (e.g. Firefox private mode)
  try {
    if (!cachedMessaging) cachedMessaging = getMessaging(app);
    return cachedMessaging;
  } catch {
    return null;
  }
}

/**
 * Builds the SW URL with Firebase config injected as query params so the
 * background SW can initialise without hard-coded credentials.
 */
function buildSwUrl(): string {
  const env = getPublicRuntimeEnv();
  const params = new URLSearchParams({
    apiKey:            env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "",
    authDomain:        env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "",
    projectId:         env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "",
    storageBucket:     env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "",
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId:             env.NEXT_PUBLIC_FIREBASE_APP_ID              ?? "",
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

/**
 * Requests notification permission, registers the messaging SW, and returns
 * the FCM registration token. Returns null if permission is denied or the
 * environment doesn't support FCM.
 */
export async function requestFcmToken(messaging: Messaging): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const swUrl = buildSwUrl();
    const swReg = await navigator.serviceWorker.register(swUrl, {
      scope: "/firebase-cloud-messaging-push-scope",
    });

    const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
    if (!vapidKey) {
      // FCM works without VAPID on some browsers, but it's recommended.
      // Proceed anyway so the feature degrades gracefully in dev.
    }

    const token = await getToken(messaging, {
      vapidKey: vapidKey ?? undefined,
      serviceWorkerRegistration: swReg,
    });

    return token ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to foreground push messages (app is open).
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  messaging: Messaging,
  handler: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void,
): () => void {
  return onMessage(messaging, handler);
}
