"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getDataSourceMode } from "@/lib/config/data-source";
import { writePresenceHeartbeat } from "@/lib/firebase/realtime";
import { publishDriverLocation } from "@/app/actions/driver";

type UseLocationContributionOptions = {
  uid: string;
  busId: string;
  routeId: string;
  deviceId: string;
};

export function useLocationContribution({
  uid,
  busId,
  routeId,
  deviceId,
}: UseLocationContributionOptions) {
  const mode = getDataSourceMode();
  const watchIdRef = useRef<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionState, setPermissionState] = useState<
    "idle" | "granted" | "denied" | "unsupported"
  >("idle");
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    setIsTracking(false);
  }, []);

  const start = useCallback(() => {
    if (mode === "mock") {
      setPermissionState("granted");
      setIsTracking(true);
      setLastUpdateAt(Date.now());
      setError(null);
      return;
    }

    if (!("geolocation" in navigator)) {
      setPermissionState("unsupported");
      setError("Geolocation is not available in this browser.");
      return;
    }

    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setPermissionState("granted");
        setLastUpdateAt(Date.now());

        const candidate = {
          uid,
          busId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading ?? undefined,
          speed: position.coords.speed ?? undefined,
          accuracy: position.coords.accuracy,
          routeMatchScore: 0.9,
          submittedAt: Date.now(),
          source: "gps" as const,
        };

        void publishDriverLocation(busId, candidate).then((result: { ok: boolean; error?: string }) => {
          if (!result.ok) {
            setError(result.error ?? "Unknown error");
          }
        });
      },
      (geoError) => {
        setPermissionState("denied");
        setError(geoError.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 8_000,
      },
    );

    setIsTracking(true);
  }, [busId, mode, uid]);

  useEffect(() => {
    if (!isTracking) {
      return;
    }

    const interval = window.setInterval(() => {
      void writePresenceHeartbeat({
        uid,
        busId,
        activeRouteId: routeId,
        deviceId,
        appState: document.visibilityState === "visible" ? "foreground" : "background",
      }).then((result) => {
        if (!result.ok) {
          setError(result.error);
        }
      });
    }, 20_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isTracking, busId, deviceId, routeId, uid]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    mode,
    isTracking,
    permissionState,
    lastUpdateAt,
    error,
    start,
    stop,
  };
}
