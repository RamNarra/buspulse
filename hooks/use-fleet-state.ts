"use client";

import { useEffect, useState } from "react";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { getRealtimeDb, subscribeToBusLocation } from "@/lib/firebase/realtime";
import { ref, onValue } from "firebase/database";

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


/**
 * Phase 1.2: Subscribes to server-aggregated `busLocations/` (written by the
 * Cloud Function aggregator) instead of raw `trackerCandidates/`.
 *
 * When `scopeBusId` is provided the listener is scoped to that single bus —
 * safe for student dashboards. Omit only for admin fleet views.
 */
export function useFleetState(scopeBusId?: string | null) {
  const [fleet, setFleet] = useState<FleetBus[]>([]);



  useEffect(() => {
    const app = getFirebaseClientApp();
    if (!app) return;

    let unsubscribe: () => void = () => {};

    if (scopeBusId) {
      const unsub = subscribeToBusLocation(scopeBusId, (loc) => {
        if (!loc) {
          setFleet([]);
          return;
        }
        
        const now = Date.now();
        const age = now - (loc.updatedAt || now);
        
        if (age > DEAD_RECKON_MAX_MS) {
          setFleet([]);
          return;
        }
        
        setFleet([{
          routeNumber: scopeBusId,
          lat: loc.lat,
          lng: loc.lng,
          activePingers: loc.sourceCount ?? 1,
          updatedAt: loc.updatedAt ?? now,
          estimated: age > DEAD_RECKON_AFTER_MS
        }]);
      });
      
      if (unsub) unsubscribe = unsub;
    } else {
      const rtdb = getRealtimeDb();
      if (!rtdb) return;
      const locationsRef = ref(rtdb, "busLocations");
      
      const unsub = onValue(locationsRef, (snapshot) => {
        if (!snapshot.exists()) {
          setFleet([]);
          return;
        }
        
        const data = snapshot.val() as Record<string, unknown>;
        const liveFleet: FleetBus[] = [];
        const now = Date.now();
        
        for (const busId in data) {
          const loc = data[busId] as { lat?: number; lng?: number; updatedAt?: number; sourceCount?: number } | null;
          if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") continue;
          
          const age = now - (loc.updatedAt || now);
          if (age > DEAD_RECKON_MAX_MS) continue;
          
          liveFleet.push({
            routeNumber: busId,
            lat: loc.lat,
            lng: loc.lng,
            activePingers: loc.sourceCount ?? 1,
            updatedAt: loc.updatedAt ?? now,
            estimated: age > DEAD_RECKON_AFTER_MS
          });
        }
        
        setFleet(liveFleet);
      });
      
      unsubscribe = unsub;
    }

    return () => {
      unsubscribe();
    };
  }, [scopeBusId]);

  return { fleet };
}
