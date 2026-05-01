"use client";

import { useEffect, useRef, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import type { BusHealthStatus } from "@/types/models";

export type FleetBusWithHealth = {
  routeNumber: string;
  lat: number;
  lng: number;
  activePingers: number;
  updatedAt: number;
  estimated: boolean;
  /** Health status from the anomaly-detection function */
  status: BusHealthStatus;
  /** Milliseconds since status was flagged as non-healthy (0 if healthy) */
  alertDurationMs: number;
};

/**
 * Merges busLocations + busHealth into a single fleet array for the admin
 * command-centre view. Health status is used to colour bus pins and show SLA
 * alerts.
 */
export function useFleetWithHealth(): {
  fleet: FleetBusWithHealth[];
  alerts: FleetBusWithHealth[];
} {
  const [fleet, setFleet] = useState<FleetBusWithHealth[]>([]);

  // Store raw locations and health independently so either update triggers a merge
  const locRef = useRef<
    Record<string, { lat: number; lng: number; updatedAt: number; sourceCount?: number; estimated?: boolean }>
  >({});
  const healthRef = useRef<
    Record<string, { status: BusHealthStatus; updatedAt: number }>
  >({});

  const merge = () => {
    const now = Date.now();
    const merged: FleetBusWithHealth[] = [];

    for (const busId in locRef.current) {
      const loc = locRef.current[busId];
      const health = healthRef.current[busId];
      const status: BusHealthStatus = health?.status ?? "healthy";

      const isUnhealthy = status !== "healthy" && status !== "degraded";
      const alertDurationMs = isUnhealthy && health?.updatedAt
        ? now - health.updatedAt
        : 0;

      merged.push({
        routeNumber: busId,
        lat: loc.lat,
        lng: loc.lng,
        activePingers: loc.sourceCount ?? 1,
        updatedAt: loc.updatedAt,
        estimated: loc.estimated ?? false,
        status,
        alertDurationMs,
      });
    }

    setFleet(merged);
  };

  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    const unsubLoc = onValue(ref(db, "busLocations"), (snap) => {
      if (!snap.exists()) {
        locRef.current = {};
      } else {
        const raw = snap.val() as Record<string, { lat?: number; lng?: number; updatedAt?: number; sourceCount?: number }>;
        const next: typeof locRef.current = {};
        for (const busId in raw) {
          const l = raw[busId];
          if (typeof l.lat === "number" && typeof l.lng === "number" && typeof l.updatedAt === "number") {
            next[busId] = {
              lat: l.lat,
              lng: l.lng,
              updatedAt: l.updatedAt,
              sourceCount: l.sourceCount,
            };
          }
        }
        locRef.current = next;
      }
      merge();
    });

    const unsubHealth = onValue(ref(db, "busHealth"), (snap) => {
      if (!snap.exists()) {
        healthRef.current = {};
      } else {
        const raw = snap.val() as Record<string, { status?: string; updatedAt?: number }>;
        const next: typeof healthRef.current = {};
        for (const busId in raw) {
          const h = raw[busId];
          if (h.status) {
            next[busId] = {
              status: h.status as BusHealthStatus,
              updatedAt: h.updatedAt ?? 0,
            };
          }
        }
        healthRef.current = next;
      }
      merge();
    });

    return () => {
      unsubLoc();
      unsubHealth();
    };
  }, []);

  const alerts = fleet.filter(
    (b) => b.status !== "healthy" && b.status !== "degraded",
  );

  return { fleet, alerts };
}
