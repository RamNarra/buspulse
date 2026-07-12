"use client";

import { useRef } from "react";

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  async function acquireWakeLock() {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Permission denied or unsupported — silent
    }
  }

  async function releaseWakeLock() {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        /* silent */
      }
      wakeLockRef.current = null;
    }
  }

  return {
    acquireWakeLock,
    releaseWakeLock,
  };
}
