"use client";

import { useEffect, useState } from "react";

import { getDataSourceMode } from "@/lib/config/data-source";
import { readBusById, readRouteAndStopsForBus } from "@/lib/firebase/firestore";
import { subscribeToDerivedBusState } from "@/lib/firebase/realtime";
import {
  getMockBusSnapshot,
  mockBus,
  mockBusHealth,
  mockBusLocation,
  mockRoute,
  mockStops,
} from "@/lib/mock/fixtures";
import type { Bus, BusHealth, BusLocation, Route, Stop } from "@/types/models";

type UseCurrentBusStateOptions = {
  busId?: string | null;
};

export function useCurrentBusState({ busId }: UseCurrentBusStateOptions) {
  const mode = getDataSourceMode();
  const initialBusId = busId ?? mockBus.id;
  const mockSnapshot = getMockBusSnapshot(initialBusId);

  const [isLoading, setIsLoading] = useState(mode === "live");
  const [error, setError] = useState<string | null>(null);
  const [bus, setBus] = useState<Bus | null>(mockSnapshot?.bus ?? mockBus);
  const [route, setRoute] = useState<Route | null>(mockSnapshot?.route ?? mockRoute);
  const [stops, setStops] = useState<Stop[]>(mockSnapshot?.stops ?? mockStops);
  const [location, setLocation] = useState<BusLocation | null>(
    mockSnapshot?.busLocation ?? mockBusLocation,
  );
  const [health, setHealth] = useState<BusHealth | null>(
    mockSnapshot?.busHealth ?? mockBusHealth,
  );
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (mode !== "live") {
      return;
    }

    async function loadMetadata() {
      if (!busId) {
        setError("Missing bus identifier.");
        setIsLoading(false);
        return;
      }

      const [busResult, routeResult] = await Promise.all([
        readBusById(busId),
        readRouteAndStopsForBus(busId),
      ]);

      if (!mounted) {
        return;
      }

      if (!busResult.ok) {
        setError(busResult.error);
        setIsLoading(false);
        return;
      }

      if (!routeResult.ok) {
        setError(routeResult.error);
        setIsLoading(false);
        return;
      }

      setBus(busResult.bus);
      setRoute(routeResult.route);
      setStops(routeResult.stops);
      setIsLoading(false);
      setError(null);
    }

    void loadMetadata();

    return () => {
      mounted = false;
    };
  }, [busId, mode, initialBusId]);

  useEffect(() => {
    if (mode !== "live" || !busId) {
      return;
    }

    const unsubscribe = subscribeToDerivedBusState(busId, (snapshot) => {
      setLocation(snapshot.location);
      setHealth(snapshot.health);
      setIsStale(snapshot.stale);
    });

    if (!unsubscribe) {
      queueMicrotask(() => {
        setError("Realtime Database is not configured for live bus state.");
      });
      return;
    }

    return () => unsubscribe();
  }, [busId, mode]);

  return {
    mode,
    isLoading,
    error,
    bus,
    route,
    stops,
    location,
    health,
    isStale,
  };
}
