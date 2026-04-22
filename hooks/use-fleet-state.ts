"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";

export type FleetBus = {
  routeNumber: string;
  lat: number;
  lng: number;
  activePingers: number;
  updatedAt: number;
};

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

      const allRoutes = snapshot.val();
      const activeFleet: FleetBus[] = [];

      for (const routeNumber in allRoutes) {
        const candidates = allRoutes[routeNumber];
        let totalLat = 0;
        let totalLng = 0;
        let count = 0;
        let latestUpdate = 0;

        for (const uid in candidates) {
          const candidate = candidates[uid];
          // Filter stale candidates (> 60 seconds)
          if (
            candidate.lat && 
            candidate.lng && 
            candidate.updatedAt && 
            (Date.now() - candidate.updatedAt < 60000)
          ) {
            totalLat += candidate.lat;
            totalLng += candidate.lng;
            count++;
            if (candidate.updatedAt > latestUpdate) latestUpdate = candidate.updatedAt;
          }
        }

        if (count > 0) {
          activeFleet.push({
            routeNumber,
            lat: totalLat / count,
            lng: totalLng / count,
            activePingers: count,
            updatedAt: latestUpdate,
          });
        }
      }

      setFleet(activeFleet);
    });

    return () => unsubscribe();
  }, []);

  return { fleet };
}
