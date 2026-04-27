"use client";

import { useEffect, useRef, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { isLocationOutlier, haversineMeters } from "@/lib/utils/geo";

export type FleetBus = {
  routeNumber: string;
  lat: number;
  lng: number;
  activePingers: number;
  updatedAt: number;
  /** True when position is extrapolated via dead reckoning, not live GPS. */
  estimated: boolean;
};

/** Max age for a ping to be considered "fresh" */
const STALE_MS = 60_000;

/**
 * If the bus hasn't received a fresh ping in this long, switch to dead
 * reckoning using the last known velocity vector.
 */
const DEAD_RECKON_AFTER_MS = 15_000;

/** Stop extrapolating after this long without any live signal. */
const DEAD_RECKON_MAX_MS = 120_000;

/** Dead-reckoning tick interval in ms */
const DEAD_RECKON_TICK_MS = 2_000;

type BusPhysics = {
  lat: number;
  lng: number;
  /** Degrees per millisecond */
  dlat_per_ms: number;
  dlng_per_ms: number;
  updatedAt: number;
  activePingers: number;
  routeNumber: string;
};

/**
 * Compute velocity vector from the two most recent clean pings of a route.
 * Returns degrees/ms in lat and lng.
 */
function computeVelocity(
  prev: { lat: number; lng: number; updatedAt: number },
  next: { lat: number; lng: number; updatedAt: number },
): { dlat_per_ms: number; dlng_per_ms: number } {
  const dt = next.updatedAt - prev.updatedAt;
  if (dt <= 0) return { dlat_per_ms: 0, dlng_per_ms: 0 };
  return {
    dlat_per_ms: (next.lat - prev.lat) / dt,
    dlng_per_ms: (next.lng - prev.lng) / dt,
  };
}

export function useFleetState() {
  const [fleet, setFleet] = useState<FleetBus[]>([]);

  // Stable reference to the physics snapshot per route, used for dead reckoning
  const physicsRef = useRef<Record<string, BusPhysics>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    // ── Live Firebase listener ───────────────────────────────────────────────
    const unsubscribe = onValue(ref(db, `trackerCandidates`), (snapshot) => {
      const now = Date.now();

      if (!snapshot.exists()) {
        physicsRef.current = {};
        setFleet([]);
        return;
      }

      const allRoutes = snapshot.val() as Record<
        string,
        Record<string, { lat?: number; lng?: number; updatedAt?: number; speed?: number }>
      >;

      const nextPhysics: Record<string, BusPhysics> = {};
      const liveFleet: FleetBus[] = [];

      for (const routeNumber in allRoutes) {
        const candidates = allRoutes[routeNumber];

        // Step 1: collect fresh, valid pings
        const fresh: { lat: number; lng: number; updatedAt: number }[] = [];
        for (const uid in candidates) {
          const c = candidates[uid];
          const isStale = typeof c.updatedAt === "number" && now - c.updatedAt > STALE_MS;
          
          if (
            typeof c.lat === "number" &&
            typeof c.lng === "number" &&
            !isStale
          ) {
            fresh.push({ lat: c.lat, lng: c.lng, updatedAt: c.updatedAt as number });
          } else if (isStale) {
             console.warn(`[Fleet] Rejected stale ping from ${uid}. Age: ${(now - (c.updatedAt || 0))/1000}s`);
          }
        }

        if (fresh.length === 0) continue;

        // Step 2: sort and remove outliers (teleport guard)
        fresh.sort((a, b) => a.updatedAt - b.updatedAt);
        const clean: typeof fresh = [fresh[0]];
        for (let i = 1; i < fresh.length; i++) {
          const prev = clean[clean.length - 1];
          const cur = fresh[i];
          if (!isLocationOutlier(prev.lat, prev.lng, prev.updatedAt, cur.lat, cur.lng, cur.updatedAt)) {
            clean.push(cur);
          }
        }
        if (clean.length === 0) continue;

        // Step 3: average clean pings
        let tLat = 0, tLng = 0, latest = 0;
        for (const p of clean) {
          tLat += p.lat; tLng += p.lng;
          if (p.updatedAt > latest) latest = p.updatedAt;
        }
        const avgLat = tLat / clean.length;
        const avgLng = tLng / clean.length;

        // Step 4: compute velocity from the two most recent clean pings
        let vel = { dlat_per_ms: 0, dlng_per_ms: 0 };
        if (clean.length >= 2) {
          vel = computeVelocity(clean[clean.length - 2], clean[clean.length - 1]);
        }

        // Step 5: sanity-check: ignore velocity if implied speed > 120 km/h
        const distTest = haversineMeters(0, 0, vel.dlat_per_ms * 1000, vel.dlng_per_ms * 1000);
        const speedMs = distTest / 1; // per ms → m/ms → * 1000 = m/s
        const validVelocity = speedMs < 33.3;

        nextPhysics[routeNumber] = {
          routeNumber,
          lat: avgLat,
          lng: avgLng,
          dlat_per_ms: validVelocity ? vel.dlat_per_ms : 0,
          dlng_per_ms: validVelocity ? vel.dlng_per_ms : 0,
          updatedAt: latest,
          activePingers: clean.length,
        };

        liveFleet.push({
          routeNumber,
          lat: avgLat,
          lng: avgLng,
          activePingers: clean.length,
          updatedAt: latest,
          estimated: false,
        });
      }

      physicsRef.current = nextPhysics;
      setFleet(liveFleet);
    });

    // ── Dead Reckoning Ticker ────────────────────────────────────────────────
    // Runs every 2 seconds; for routes whose last ping was 15–120 seconds ago,
    // extrapolates position using the last known velocity vector.
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const physics = physicsRef.current;
      if (Object.keys(physics).length === 0) return;

      const extrapolated: FleetBus[] = [];

      for (const routeNumber in physics) {
        const p = physics[routeNumber];
        const age = now - p.updatedAt;

        if (age < DEAD_RECKON_AFTER_MS) {
          // Fresh — live fleet update handles this; skip to avoid overwriting
          continue;
        }

        if (age > DEAD_RECKON_MAX_MS) {
          // Signal lost for > 2 min — drop from fleet entirely
          continue;
        }

        // Extrapolate: pos = last_pos + velocity × elapsed_since_last_ping
        const elapsed = age;
        const estLat = p.lat + p.dlat_per_ms * elapsed;
        const estLng = p.lng + p.dlng_per_ms * elapsed;

        extrapolated.push({
          routeNumber,
          lat: estLat,
          lng: estLng,
          activePingers: p.activePingers,
          updatedAt: p.updatedAt,
          estimated: true,
        });
      }

      if (extrapolated.length > 0) {
        setFleet((prev) => {
          // Replace live entries for routes that are now in dead-reckoning mode
          const liveRoutes = new Set(prev.filter((b) => !b.estimated).map((b) => b.routeNumber));
          const liveOnly = prev.filter((b) => !b.estimated);
          const toAdd = extrapolated.filter((b) => !liveRoutes.has(b.routeNumber));
          return [...liveOnly, ...toAdd];
        });
      }
    }, DEAD_RECKON_TICK_MS);

    return () => {
      unsubscribe();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  return { fleet };
}
