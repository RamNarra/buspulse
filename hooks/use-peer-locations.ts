"use client";

import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";

export type PeerLocation = {
  uid: string;
  lat: number;
  lng: number;
  updatedAt: number;
};

/**
 * Subscribes to all individual tracker candidates for a given busId/route
 * and returns their raw locations so they can be shown as individual dots on the map.
 * This is what enables "see your friend's blue dot".
 */
export function usePeerLocations(busId: string | null | undefined, myUid: string | null | undefined) {
  const [peers, setPeers] = useState<PeerLocation[]>([]);

  useEffect(() => {
    if (!busId) return;

    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    // Subscribe to all boarded contributors for this bus route
    const candidatesRef = ref(db, `trackerCandidates/${busId}`);
    const unsubscribe = onValue(candidatesRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPeers([]);
        return;
      }

      const data = snapshot.val();
      const now = Date.now();
      const activePeers: PeerLocation[] = [];

      for (const uid in data) {
        // Don't show the current user as a "peer" — they already have the blue dot
        if (uid === myUid) continue;

        const candidate = data[uid];
        // Only show peers that are fresh (< 60 seconds old)
        if (
          candidate.lat &&
          candidate.lng &&
          candidate.updatedAt &&
          now - candidate.updatedAt < 60000
        ) {
          activePeers.push({
            uid,
            lat: candidate.lat,
            lng: candidate.lng,
            updatedAt: candidate.updatedAt,
          });
        }
      }

      setPeers(activePeers);
    });

    return () => unsubscribe();
  }, [busId, myUid]);

  return { peers };
}
