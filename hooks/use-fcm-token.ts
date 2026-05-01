"use client";

import { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";

import { getFirebaseClientApp } from "@/lib/firebase/client";
import { getFirebaseMessaging, requestFcmToken, onForegroundMessage } from "@/lib/firebase/messaging";
import { getFirestoreDb } from "@/lib/firebase/firestore";
import { useAuthContext } from "@/components/auth/auth-provider";

export type ForegroundNotification = {
  title: string;
  body: string;
  busId?: string;
};

/**
 * useFcmToken
 *
 * - Requests notification permission once per session.
 * - Gets the FCM registration token and saves it to Firestore
 *   `students/{uid}` so server-side code can target this device.
 * - Listens for foreground push messages and surfaces them via
 *   the returned `notification` state (cleared after 8 s).
 */
export function useFcmToken() {
  const { user } = useAuthContext();
  const [notification, setNotification] = useState<ForegroundNotification | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user) return;
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FCM_ENABLED !== "true") return;

    const app = getFirebaseClientApp();
    if (!app) return;

    const messaging = getFirebaseMessaging(app);
    if (!messaging) return;

    let mounted = true;

    async function init() {
      if (!messaging) return;
      const token = await requestFcmToken(messaging);
      if (!token || !mounted) return;

      // Persist token so the Cloud Function can send targeted pushes.
      try {
        const db = getFirestoreDb();
        if (db) {
          await setDoc(
            doc(db, "students", user!.uid),
            { fcmToken: token, fcmUpdatedAt: Date.now() },
            { merge: true },
          );
        }
      } catch {
        // Non-blocking — token save failure just means no targeted push
      }

      // Foreground messages: show in-app toast instead of system notification
      cleanupRef.current = onForegroundMessage(messaging, (payload) => {
        const { title = "BusPulse", body = "" } = payload.notification ?? {};
        const busId = payload.data?.busId;
        setNotification({ title, body, busId });
        // Auto-dismiss after 8 s
        setTimeout(() => setNotification(null), 8_000);
      });
    }

    void init();

    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
  }, [user]);

  return { notification, dismissNotification: () => setNotification(null) };
}
