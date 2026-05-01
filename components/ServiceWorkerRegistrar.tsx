"use client";

import { useEffect } from "react";

/**
 * Registers the BusPulse service worker for offline GPS cache.
 * Only active in production or when NEXT_PUBLIC_SW_ENABLED is explicitly "true".
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) return;

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_SW_ENABLED !== "true"
    ) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => console.warn("SW registration failed:", err));
  }, []);

  return null;
}
