"use client";

import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { useFcmToken } from "@/hooks/use-fcm-token";

/**
 * FcmNotificationManager
 *
 * Registers this device for FCM push notifications (requests permission,
 * saves token to Firestore) and renders a foreground toast when a push
 * arrives while the app is open.
 */
export function FcmNotificationManager() {
  const router = useRouter();
  const { notification, dismissNotification } = useFcmToken();

  if (!notification) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-2xl border border-indigo-500/30 bg-slate-900/95 px-4 py-3 shadow-xl shadow-black/40 backdrop-blur-md"
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20">
        <Bell className="h-4 w-4 text-indigo-400" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{notification.title}</p>
        <p className="mt-0.5 text-xs text-slate-300">{notification.body}</p>
        {notification.busId && (
          <button
            onClick={() => {
              dismissNotification();
              router.push(`/bus/${notification.busId}`);
            }}
            className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            View bus →
          </button>
        )}
      </div>

      <button
        onClick={dismissNotification}
        aria-label="Dismiss notification"
        className="mt-0.5 rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
