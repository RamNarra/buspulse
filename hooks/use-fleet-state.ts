"use client";

import { useEffect, useRef, useState } from "react";
import { getFirestore, onSnapshot, collection, doc } from "firebase/firestore";
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
    const db = getFirestore(app);

    // Read directly from the highly constrained live_buses Firestore collection.
    // Ensure frontend is always synchronized with backend state perfectly without interpolation loops
    let unsubscribe: () => void;

    if (scopeBusId) {
      const docRef = doc(db, "live_buses", scopeBusId);
      unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) {
          setFleet([]);
          return;
        }
        
        const loc = docSnap.data();
        if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
        
        const now = Date.now();
        const age = now - (loc.updatedAt || now);
        
        // Don't render extremely stale markers (offline)
        if (age > DEAD_RECKON_MAX_MS) {
          setFleet([]);
          return;
        }
        
        setFleet([{
          routeNumber: scopeBusId,
          lat: loc.lat,
          lng: loc.lng,
          activePingers: loc.activePingers ?? 1,
          updatedAt: loc.updatedAt ?? now,
          estimated: age > DEAD_RECKON_AFTER_MS
        }]);
      });
    } else {
       const colRef = collection(db, "live_buses");
       unsubscribe = onSnapshot(colRef, (colSnap) => {
         if (colSnap.empty) {
           setFleet([]);
           return;
         }
         
         const liveFleet: FleetBus[] = [];
         const now = Date.now();
         
         colSnap.forEach((docSnap) => {
           const loc = docSnap.data();
           if (typeof loc.lat !== "number" || typeof loc.lng !== "number") return;
           
           const age = now - (loc.updatedAt || now);
           if (age > DEAD_RECKON_MAX_MS) return;
           
           liveFleet.push({
             routeNumber: docSnap.id,
             lat: loc.lat,
             lng: loc.lng,
             activePingers: loc.activePingers ?? 1,
             updatedAt: loc.updatedAt ?? now,
             estimated: age > DEAD_RECKON_AFTER_MS
           });
         });
         
         setFleet(liveFleet);
       });
    }

    return () => {
      unsubscribe();
    };
  }, [scopeBusId]);

  return { fleet };
}
