'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

/** Subscribe to live bus location + health from Realtime DB. Auto-calculates ETA. */
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

    const unsub = subscribeToDerivedBusState(busId, (snapshot) => {
      const etaMinutes =
        snapshot.location && userStop
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
    });

    if (unsub) {
      unsubRef.current = unsub;
    }
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
