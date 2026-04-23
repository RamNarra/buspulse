"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { isLocationOutlier } from "@/lib/utils/geo";

export type FleetBus = {
  routeNumber: string;
  lat: number;
  lng: number;
  activePingers: number;
  updatedAt: number;
};

/** Max age for a ping to be considered active */
const STALE_MS = 30_000;

export function useFleetState() {
  const [fleet, setFleet] = useState<FleetBus[]>([]);

  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    const unsubscribe = onValue(ref(db, `trackerCandidates`), (snapshot) => {
      if (!snapshot.exists()) {
        setFleet([]);
        return;
      }

      const allRoutes = snapshot.val() as Record<
        string,
        Record<string, { lat?: number; lng?: number; updatedAt?: number }>
      >;
      const now = Date.now();
      const activeFleet: FleetBus[] = [];

      for (const routeNumber in allRoutes) {
        const candidates = allRoutes[routeNumber];

        // ── Step 1: collect fresh, valid pings ──────────────────────────────
        const fresh: { lat: number; lng: number; updatedAt: number }[] = [];
        for (const uid in candidates) {
          const c = candidates[uid];
          if (
            typeof c.lat === "number" &&
            typeof c.lng === "number" &&
            typeof c.updatedAt === "number" &&
            now - c.updatedAt < STALE_MS
          ) {
            fresh.push({ lat: c.lat, lng: c.lng, updatedAt: c.updatedAt });
          }
        }

        if (fresh.length === 0) continue;

        // ── Step 2: Sort by timestamp and remove outliers ────────────────────
        fresh.sort((a, b) => a.updatedAt - b.updatedAt);
        const clean: typeof fresh = [fresh[0]];
        for (let i = 1; i < fresh.length; i++) {
          const prev = clean[clean.length - 1];
          const cur = fresh[i];
          if (
            !isLocationOutlier(
              prev.lat, prev.lng, prev.updatedAt,
              cur.lat,  cur.lng,  cur.updatedAt,
            )
          ) {
            clean.push(cur);
          }
          // Silently drop teleporting pings
        }

        if (clean.length === 0) continue;

        // ── Step 3: Average the clean pings ──────────────────────────────────
        let tLat = 0, tLng = 0, latest = 0;
        for (const p of clean) {
          tLat += p.lat;
          tLng += p.lng;
          if (p.updatedAt > latest) latest = p.updatedAt;
        }

        activeFleet.push({
          routeNumber,
          lat: tLat / clean.length,
          lng: tLng / clean.length,
          activePingers: clean.length,
          updatedAt: latest,
        });
      }

      setFleet(activeFleet);
    });

    return () => unsubscribe();
  }, []);

  return { fleet };
}
