"use client";

import { useEffect, useRef, useState } from "react";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { Box, CircularProgress, Chip, Stack, Typography } from "@mui/material";

import { getPublicRuntimeEnv, getSetupStatus } from "@/lib/config/env";
import type { Bus, BusLocation } from "@/types/models";

type BusMapProps = {
  bus: Bus;
  busLocation: BusLocation | null;
};

type MapLoadState = "preview" | "loading" | "ready" | "error";
type MapResolutionState = "idle" | "ready" | "error";

type GoogleMapInstance = {
  setCenter: (position: { lat: number; lng: number }) => void;
};

type GoogleMarkerInstance = {
  setPosition: (position: { lat: number; lng: number }) => void;
  setMap?: (map: GoogleMapInstance | null) => void;
};

type WindowWithGoogleMaps = Window & {
  google?: {
    maps?: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
      Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
    };
  };
  gm_authFailure?: (() => void) | undefined;
};

const GOOGLE_MAPS_SCRIPT_ID = "buspulse-google-maps-script";
let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps is only available in the browser."));
  }

  const globalWindow = window as WindowWithGoogleMaps;
  if (globalWindow.google?.maps) {
    return Promise.resolve();
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existingScript) {
      const status = existingScript.dataset.buspulseStatus;
      if (status === "error") {
        googleMapsScriptPromise = null;
        reject(new Error("Google Maps script failed to load."));
        return;
      }

      if (status === "loaded" && globalWindow.google?.maps) {
        resolve();
        return;
      }

      const onLoad = () => {
        if ((window as WindowWithGoogleMaps).google?.maps) {
          resolve();
          return;
        }

        googleMapsScriptPromise = null;
        reject(new Error("Google Maps script loaded without maps namespace."));
      };

      const onError = () => {
        googleMapsScriptPromise = null;
        reject(new Error("Google Maps script failed to load."));
      };

      existingScript.addEventListener("load", onLoad, { once: true });
      existingScript.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;

    script.onload = () => {
      script.dataset.buspulseStatus = "loaded";

      if ((window as WindowWithGoogleMaps).google?.maps) {
        resolve();
        return;
      }

      googleMapsScriptPromise = null;
      reject(new Error("Google Maps script loaded without maps namespace."));
    };

    script.onerror = () => {
      script.dataset.buspulseStatus = "error";
      googleMapsScriptPromise = null;
      reject(new Error("Google Maps script failed to load."));
    };

    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

export function BusMap({ bus, busLocation }: BusMapProps) {
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const latestPositionRef = useRef<{ lat: number; lng: number }>({ lat: 17.506, lng: 78.382 });
  const [mapResolutionState, setMapResolutionState] = useState<MapResolutionState>("idle");

  const setup = getSetupStatus();
  const mapsKey = getPublicRuntimeEnv().NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const canAttemptLiveMap = setup.mapsReady && mapsKey.length > 0;
  const mapLoadState: MapLoadState = !canAttemptLiveMap
    ? "preview"
    : mapResolutionState === "ready"
      ? "ready"
      : mapResolutionState === "error"
        ? "error"
        : "loading";

  const lat = busLocation?.lat ?? 17.506;
  const lng = busLocation?.lng ?? 78.382;

  useEffect(() => {
    latestPositionRef.current = { lat, lng };
  }, [lat, lng]);

  useEffect(() => {
    if (!canAttemptLiveMap) {
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      mapRef.current = null;
      return;
    }

    let cancelled = false;

    const globalWindow = window as WindowWithGoogleMaps;
    const previousAuthFailure = globalWindow.gm_authFailure;
    const onAuthFailure = () => {
      if (!cancelled) {
        setMapResolutionState("error");
      }
      previousAuthFailure?.();
    };

    globalWindow.gm_authFailure = onAuthFailure;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setMapResolutionState("error");
      }
    }, 12_000);

    const initialPosition = latestPositionRef.current;

    void loadGoogleMapsScript(mapsKey)
      .then(() => {
        if (cancelled) {
          return;
        }

        const mapsApi = globalWindow.google?.maps;
        if (!mapsApi || !mapCanvasRef.current) {
          setMapResolutionState("error");
          return;
        }

        markerRef.current?.setMap?.(null);

        const map = new mapsApi.Map(mapCanvasRef.current, {
          center: initialPosition,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#dce5f4",
        });

        const marker = new mapsApi.Marker({
          map,
          position: initialPosition,
          title: bus.code,
        });

        mapRef.current = map;
        markerRef.current = marker;
        setMapResolutionState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setMapResolutionState("error");
        }
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);

      if ((window as WindowWithGoogleMaps).gm_authFailure === onAuthFailure) {
        (window as WindowWithGoogleMaps).gm_authFailure = previousAuthFailure;
      }
    };
  }, [bus.code, canAttemptLiveMap, mapsKey]);

  useEffect(() => {
    if (mapLoadState !== "ready") {
      return;
    }

    const nextPosition = { lat, lng };

    mapRef.current?.setCenter(nextPosition);
    markerRef.current?.setPosition(nextPosition);
  }, [lat, lng, mapLoadState]);

  useEffect(() => {
    return () => {
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  if (mapLoadState !== "ready") {
    const fallbackTitle =
      mapLoadState === "loading"
        ? "Loading live map"
        : mapLoadState === "error"
          ? "Map temporarily unavailable"
          : "Map preview mode";

    const fallbackSubtitle =
      mapLoadState === "loading"
        ? "Preparing map tiles for your route."
        : mapLoadState === "error"
          ? "Live tiles could not be loaded. Tracking details remain active below."
          : "Live tiles are not configured. Tracking details remain active below.";

    const fallbackBadge =
      mapLoadState === "loading"
        ? "Connecting"
        : mapLoadState === "error"
          ? "Fallback"
          : "Preview";

    return (
      <Box
        sx={{
          height: "100%",
          width: "100%",
          position: "relative",
          borderRadius: { xs: 0, md: 3 },
          overflow: "hidden",
          background:
            "radial-gradient(circle at 14% 16%, rgba(18,90,212,.22), transparent 30%), radial-gradient(circle at 86% 11%, rgba(0,163,122,.20), transparent 34%), linear-gradient(135deg, #dce7f8 0%, #f4f8ff 45%, #e8f5f2 100%)",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(transparent 96%, rgba(18,90,212,.08) 96%), linear-gradient(90deg, transparent 96%, rgba(18,90,212,.08) 96%)",
            backgroundSize: "36px 36px",
          }}
        />
        <Stack
          spacing={1.5}
          sx={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mapLoadState === "loading" ? (
            <CircularProgress size={30} />
          ) : (
            <MapRoundedIcon color="primary" sx={{ fontSize: 34 }} />
          )}
          <Typography variant="h6">{fallbackTitle}</Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ px: 4 }}>
            {fallbackSubtitle}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Chip size="small" color="primary" label={fallbackBadge} />
            <Chip size="small" icon={<SyncRoundedIcon />} label={bus.code} />
          </Stack>
          <Stack direction="row" spacing={0.6} sx={{ alignItems: "center" }}>
            <RoomRoundedIcon color="primary" sx={{ fontSize: 18 }} />
            <Typography variant="caption" color="text.secondary">
              Centered near {lat.toFixed(4)}, {lng.toFixed(4)}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        borderRadius: { xs: 0, md: 3 },
        overflow: "hidden",
        backgroundColor: "#dce5f4",
      }}
    >
      <Box ref={mapCanvasRef} sx={{ width: "100%", height: "100%" }} aria-label={`${bus.code} live map`} />
    </Box>
  );
}
