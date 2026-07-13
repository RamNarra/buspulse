'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { getFirebaseClientApp } from '@/lib/firebase/client';
import type { BusLocation, BusHealth, Stop } from '@/types/models';
import { subscribeToDerivedBusState } from '@/lib/firebase/realtime';
import { estimateEtaMinutes } from '@/lib/live/eta';

interface UseLiveBusStateOptions {
  busId: string | null;
  userStop?: Stop | null;
}

export interface LiveBusState {
  location: BusLocation | null;
  health: BusHealth | null;
  stale: boolean;
  confidence: number | null;
  lastUpdatedAt: number | null;
  etaMinutes: number | null;
  isConnected: boolean;
}

/** Subscribe to live bus location + health from Realtime DB. Auto-calculates ETA with client fallback. */
export function useLiveBusState({
  busId,
  userStop,
}: UseLiveBusStateOptions): LiveBusState {
  const [state, setState] = useState<LiveBusState>({
    location: null,
    health: null,
    stale: true,
    confidence: null,
    lastUpdatedAt: null,
    etaMinutes: null,
    isConnected: false,
  });

  const unsubRef = useRef<(() => void) | null>(null);

  const subscribe = useCallback(() => {
    if (!busId) return;

    const app = getFirebaseClientApp();
    const db = app ? getDatabase(app) : null;
    let unsubCandidates: (() => void) | null = null;

    const unsub = subscribeToDerivedBusState(busId, (snapshot) => {
      // 1. Check if we received server-aggregated location
      if (snapshot.location) {
        if (unsubCandidates) {
          unsubCandidates();
          unsubCandidates = null;
        }

        const etaMinutes = userStop
          ? estimateEtaMinutes(snapshot.location, userStop)
          : null;

        setState({
          location: snapshot.location,
          health: snapshot.health,
          stale: snapshot.stale,
          confidence: snapshot.confidence,
          lastUpdatedAt: snapshot.lastUpdatedAt,
          etaMinutes,
          isConnected: true,
        });
      } else if (db) {
        // 2. If no server aggregation exists, fallback to raw tracker candidates directly
        const candidatesRef = ref(db, `trackerCandidates/${busId}`);
        
        if (unsubCandidates) {
          unsubCandidates();
        }

        unsubCandidates = onValue(candidatesRef, (candSnap) => {
          const val = candSnap.val();
          if (val) {
            const keys = Object.keys(val);
            if (keys.length > 0) {
              const firstCand = val[keys[0]];
              const fallbackLoc: BusLocation = {
                lat: firstCand.lat,
                lng: firstCand.lng,
                accuracy: firstCand.accuracy ?? 15,
                updatedAt: firstCand.updatedAt ?? Date.now(),
                confidence: firstCand.confidence ?? 0.8,
                sourceCount: firstCand.sourceCount ?? 1,
                routeMatchScore: firstCand.routeMatchScore ?? 1,
                speed: firstCand.speed,
                heading: firstCand.heading,
              };

              const etaMinutes = userStop
                ? estimateEtaMinutes(fallbackLoc, userStop)
                : null;

              setState({
                location: fallbackLoc,
                health: snapshot.health ?? {
                  busId,
                  status: 'healthy',
                  activeContributors: 1,
                  staleCandidateCount: 0,
                  lastDerivedAt: Date.now(),
                },
                stale: false,
                confidence: fallbackLoc.confidence,
                lastUpdatedAt: fallbackLoc.updatedAt,
                etaMinutes,
                isConnected: true,
              });
              return;
            }
          }

          // No candidates and no server location
          setState({
            location: null,
            health: snapshot.health,
            stale: true,
            confidence: null,
            lastUpdatedAt: null,
            etaMinutes: null,
            isConnected: true,
          });
        });
      }
    });

    unsubRef.current = () => {
      unsub?.();
      if (unsubCandidates) {
        unsubCandidates();
      }
    };
  }, [busId, userStop]);

  useEffect(() => {
    subscribe();
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [subscribe]);

  return state;
}

/** Track user's geolocation. Returns null if not permitted. */
export function useUserLocation(): GeolocationCoordinates | null {
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setCoords(pos.coords),
      () => setCoords(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  return coords;
}
