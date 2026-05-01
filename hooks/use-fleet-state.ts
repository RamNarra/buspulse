"use client";

import { useEffect, useRef, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { haversineMeters } from "@/lib/utils/geo";

export type FleetBus = {
  routeNumber: string;
  lat: number;
  lng: number;
  activePingers: number;
  updatedAt: number;
  /** True when position is extrapolated via dead reckoning, not live GPS. */
  estimated: boolean;
};

/**
 * If the bus hasn't received a fresh server-aggregated ping in this long,
 * switch to dead reckoning using the last known velocity vector.
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
 * Phase 1.2: Subscribes to server-aggregated `busLocations/` (written by the
 * Cloud Function aggregator) instead of raw `trackerCandidates/`.
 *
 * When `scopeBusId` is provided the listener is scoped to that single bus —
 * safe for student dashboards. Omit only for admin fleet views.
 */
export function useFleetState(scopeBusId?: string | null) {
  const [fleet, setFleet] = useState<FleetBus[]>([]);

  const physicsRef = useRef<Record<string, BusPhysics>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    // Phase 1.2: read from `busLocations` (server-aggregated).
    // Only the Cloud Function aggregator writes here — clients cannot.
    const listenPath = scopeBusId
      ? `busLocations/${scopeBusId}`
      : `busLocations`;

    const unsubscribe = onValue(ref(db, listenPath), (snapshot) => {
      const now = Date.now();

      if (!snapshot.exists()) {
        physicsRef.current = {};
        setFleet([]);
        return;
      }

      const rawVal = snapshot.val() as Record<string, unknown>;

      // When scoped to a single busId the snapshot is the BusLocation object.
      // Wrap it under the busId key so the loop stays uniform.
      const allLocations: Record<
        string,
        { lat?: number; lng?: number; updatedAt?: number; speed?: number; heading?: number; sourceCount?: number }
      > = scopeBusId
        ? { [scopeBusId]: rawVal as { lat?: number; lng?: number; updatedAt?: number; speed?: number; heading?: number; sourceCount?: number } }
        : (rawVal as Record<string, { lat?: number; lng?: number; updatedAt?: number; speed?: number; heading?: number; sourceCount?: number }>);

      const nextPhysics: Record<string, BusPhysics> = {};
      const liveFleet: FleetBus[] = [];

      for (const routeNumber in allLocations) {
        const loc = allLocations[routeNumber];

        if (
          typeof loc.lat !== "number" ||
          typeof loc.lng !== "number" ||
          typeof loc.updatedAt !== "number"
        ) {
          continue;
        }

        // Derive velocity for dead reckoning from consecutive position diffs.
        let dLat = 0;
        let dLng = 0;
        const prev = physicsRef.current[routeNumber];

        if (prev && prev.updatedAt < loc.updatedAt) {
          const dt = loc.updatedAt - prev.updatedAt;
          if (dt > 0) {
            const vLat = (loc.lat - prev.lat) / dt;
            const vLng = (loc.lng - prev.lng) / dt;
            // Sanity-check: reject if implied speed > 120 km/h (33.3 m/s).
            const speedMs = haversineMeters(
              loc.lat,
              loc.lng,
              loc.lat + vLat * 1000,
              loc.lng + vLng * 1000,
            );
            if (speedMs < 33.3) {
              dLat = vLat;
              dLng = vLng;
            }
          }
        } else if (
          typeof loc.speed === "number" &&
          typeof loc.heading === "number"
        ) {
          // Fall back to aggregator-computed speed+heading when available.
          const headingRad = (loc.heading * Math.PI) / 180;
          const cosLat = Math.cos((loc.lat * Math.PI) / 180);
          dLat =
            (loc.speed * Math.cos(headingRad)) / (111_111 * 1_000);
          dLng =
            (loc.speed * Math.sin(headingRad)) / (111_111 * cosLat * 1_000);
        }

        nextPhysics[routeNumber] = {
          routeNumber,
          lat: loc.lat,
          lng: loc.lng,
          dlat_per_ms: dLat,
          dlng_per_ms: dLng,
          updatedAt: loc.updatedAt,
          activePingers: loc.sourceCount ?? 1,
        };

        liveFleet.push({
          routeNumber,
          lat: loc.lat,
          lng: loc.lng,
          activePingers: loc.sourceCount ?? 1,
          updatedAt: loc.updatedAt,
          estimated: false,
        });
      }

      physicsRef.current = nextPhysics;
      setFleet(liveFleet);
    });

    // ── Dead Reckoning Ticker ────────────────────────────────────────────────
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const physics = physicsRef.current;
      if (Object.keys(physics).length === 0) return;

      const extrapolated: FleetBus[] = [];

      for (const routeNumber in physics) {
        const p = physics[routeNumber];
        const age = now - p.updatedAt;

        if (age < DEAD_RECKON_AFTER_MS) continue;
        if (age > DEAD_RECKON_MAX_MS) continue;

        extrapolated.push({
          routeNumber,
          lat: p.lat + p.dlat_per_ms * age,
          lng: p.lng + p.dlng_per_ms * age,
          activePingers: p.activePingers,
          updatedAt: p.updatedAt,
          estimated: true,
        });
      }

      if (extrapolated.length > 0) {
        setFleet((prev) => {
          const liveRoutes = new Set(
            prev.filter((b) => !b.estimated).map((b) => b.routeNumber),
          );
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
  }, [scopeBusId]);

  return { fleet };
}
