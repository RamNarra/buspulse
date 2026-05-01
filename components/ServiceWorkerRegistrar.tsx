"use client";

import { useEffect, useState } from "react";

/**
 * ServiceWorkerRegistrar
 *
 * Registers the BusPulse service worker from /api/sw — a dynamic Next.js
 * route that injects the Vercel deployment ID into the cache-name constant on
 * every build. This means the SW file bytes change on every deploy, and the
 * browser automatically triggers the SW update cycle.
 *
 * Auto-update flow:
 *  1. Browser fetches /api/sw — file has changed (new deploy ID) → installs new SW.
 *  2. New SW calls self.skipWaiting() → activates immediately.
 *  3. New SW calls self.clients.claim() → takes over all open tabs.
 *  4. navigator.serviceWorker fires 'controllerchange'.
 *  5. This component catches it, shows "Updating…" briefly, then reloads.
 *  6. User is now on the latest version. Zero manual steps.
 *
 * Additionally, we poll for updates every 60 s so long-lived sessions pick up
 * new deploys even if the browser doesn't check on its own.
 */
export function ServiceWorkerRegistrar() {
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_SW_ENABLED !== "true"
    ) return;

    let refreshing = false;

    // When a new SW takes control of this page, reload to use fresh assets.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      setUpdating(true);
      // Brief delay so the "Updating…" toast is visible before reload.
      setTimeout(() => window.location.reload(), 500);
    });

    // Handle message from the legacy /sw.js telling this client to re-register.
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SW_LEGACY_UNREGISTER") {
        registerSW();
      }
    });

    function registerSW() {
      navigator.serviceWorker
        .register("/api/sw", {
          scope: "/",
          // updateViaCache: 'none' tells the browser to bypass its HTTP cache
          // when fetching the SW script — so it always gets the latest version.
          updateViaCache: "none",
        })
        .then((registration) => {
          // If a SW is already waiting (installed but not yet active), activate it.
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          // When a new SW is found during this session (e.g., user kept the tab
          // open and we pushed a deploy), trigger SKIP_WAITING as soon as it
          // finishes installing.
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New version is ready — skip waiting so it activates immediately.
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });

          // Poll for SW updates every 60 seconds so long-lived sessions catch
          // new deploys without requiring a full page refresh from the user.
          const updateInterval = setInterval(
            () => registration.update().catch(() => {}),
            60_000,
          );

          // Also check when the tab becomes visible again (user switches back).
          const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
              registration.update().catch(() => {});
            }
          };
          document.addEventListener("visibilitychange", handleVisibilityChange);

          return () => {
            clearInterval(updateInterval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
          };
        })
        .catch((err) => console.warn("[SW] Registration failed:", err));
    }

    registerSW();
  }, []);

  if (!updating) return null;

  // Minimal "updating" overlay — visible for ~500 ms before reload.
  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-2xl">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        <span className="text-sm font-semibold text-slate-900">
          Updating BusPulse…
        </span>
      </div>
    </div>
  );
}

