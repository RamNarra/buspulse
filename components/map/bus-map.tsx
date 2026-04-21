"use client";

import { useEffect, useRef, useState } from "react";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import RoomRoundedIcon from "@mui/icons-material/RoomRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { Box, Button, CircularProgress, Chip, Stack, Typography } from "@mui/material";

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
  fitBounds: (bounds: unknown) => void;
};

type GoogleMarkerInstance = {
  setPosition: (position: { lat: number; lng: number }) => void;
  setMap?: (map: GoogleMapInstance | null) => void;
  setIcon?: (icon: Record<string, unknown> | string) => void;
};

type WindowWithGoogleMaps = Window & {
  google?: {
    maps?: {
      Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
      Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
      LatLngBounds: new () => unknown;
      SymbolPath: { CIRCLE: number };
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
    const globalWindow = window as WindowWithGoogleMaps & {
      __buspulse_google_maps_callback?: () => void;
    };

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existingScript) {
      const status = existingScript.dataset.buspulseStatus;
      if (status === "error") {
        existingScript.remove();
        googleMapsScriptPromise = null;
      } else if (status === "loaded" && globalWindow.google?.maps) {
        resolve();
        return;
      } else {
        const prevCallback = globalWindow.__buspulse_google_maps_callback;
        globalWindow.__buspulse_google_maps_callback = () => {
          if (prevCallback) prevCallback();
          resolve();
        };
        const onError = () => {
          googleMapsScriptPromise = null;
          reject(new Error("Google Maps script failed to load."));
        };
        existingScript.addEventListener("error", onError, { once: true });
        return;
      }
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;

    globalWindow.__buspulse_google_maps_callback = () => {
      script.dataset.buspulseStatus = "loaded";
      resolve();
    };

    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&callback=__buspulse_google_maps_callback`;

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
  const userMarkerRef = useRef<GoogleMarkerInstance | null>(null);
  const latestPositionRef = useRef<{ lat: number; lng: number }>({ lat: 17.506, lng: 78.382 });
  
  const [mapResolutionState, setMapResolutionState] = useState<MapResolutionState>("idle");
  const [mapAttempt, setMapAttempt] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const hasCenteredOnUserRef = useRef(false);

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

  const busLat = busLocation?.lat ?? 17.506;
  const busLng = busLocation?.lng ?? 78.382;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    latestPositionRef.current = { lat: busLat, lng: busLng };
  }, [busLat, busLng]);

  useEffect(() => {
    if (!canAttemptLiveMap) {
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      userMarkerRef.current?.setMap?.(null);
      userMarkerRef.current = null;
      mapRef.current = null;
      return;
    }

    let cancelled = false;
    const globalWindow = window as WindowWithGoogleMaps;
    const previousAuthFailure = globalWindow.gm_authFailure;
    
    const onAuthFailure = () => {
      if (!cancelled) setMapResolutionState("error");
      previousAuthFailure?.();
    };

    globalWindow.gm_authFailure = onAuthFailure;

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) setMapResolutionState("error");
    }, 12_000);

    const initialPosition = latestPositionRef.current;

    void loadGoogleMapsScript(mapsKey)
      .then(() => {
        if (cancelled) return;

        const mapsApi = globalWindow.google?.maps;
        if (!mapsApi || !mapCanvasRef.current) {
          setMapResolutionState("error");
          return;
        }

        markerRef.current?.setMap?.(null);
        userMarkerRef.current?.setMap?.(null);

        const map = new mapsApi.Map(mapCanvasRef.current, {
          center: userLocation || initialPosition,
          zoom: 15,
          mapTypeId: "hybrid",
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#dce5f4",
        });

        const busMarker = new mapsApi.Marker({
          map,
          position: initialPosition,
          title: bus.code,
        });

        const userMarker = new mapsApi.Marker({
          map,
          position: userLocation || initialPosition,
          title: "Your Location",
          icon: {
            path: mapsApi.SymbolPath?.CIRCLE || 0,
            scale: 8,
            fillColor: "#4285F4",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          }
        });

        mapRef.current = map;
        markerRef.current = busMarker;
        userMarkerRef.current = userMarker;
        (globalWindow as any)._test_mapCenter = map;
        setMapResolutionState("ready");
      })
      .catch(() => {
        if (!cancelled) setMapResolutionState("error");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus.code, canAttemptLiveMap, mapsKey, mapAttempt]);

  useEffect(() => {
    if (mapLoadState !== "ready") return;

    if (userLocation) {
        userMarkerRef.current?.setPosition(userLocation);

        if (!hasCenteredOnUserRef.current && userLocation.lat !== 0) {
            mapRef.current?.setCenter(userLocation);
            hasCenteredOnUserRef.current = true;
        }
    }

    markerRef.current?.setPosition({ lat: busLat, lng: busLng });
  }, [busLat, busLng, userLocation, mapLoadState]);

  useEffect(() => {
    return () => {
      markerRef.current?.setMap?.(null);
      markerRef.current = null;
      userMarkerRef.current?.setMap?.(null);
      userMarkerRef.current = null;
      mapRef.current = null;
    };
  }, []);

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
        backgroundColor: "#dce5f4",
      }}
    >
      <Box
        ref={mapCanvasRef}
        sx={{
          width: "100%",
          height: "100%",
          opacity: mapLoadState === "ready" ? 1 : 0,
          pointerEvents: mapLoadState === "ready" ? "auto" : "none",
        }}
        aria-label={`${bus.code} live map`}
      />

      {mapLoadState !== "ready" && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 4,
            textAlign: "center",
          }}
        >
          <Stack sx={{ alignItems: "center" }} spacing={2.5}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                backgroundColor: "background.paper",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: 2,
                mb: 1,
              }}
            >
              {mapLoadState === "loading" ? (
                <CircularProgress size={28} thickness={4} />
              ) : (
                <MapRoundedIcon color={mapLoadState === "error" ? "error" : "primary"} sx={{ fontSize: 32 }} />
              )}
            </Box>
            <Chip
              label={fallbackBadge}
              size="small"
              color={mapLoadState === "error" ? "error" : "primary"}
              variant="outlined"
              sx={{ fontWeight: 600, px: 1 }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: "700" }} color="text.primary" gutterBottom>
                {fallbackTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280, mx: "auto" }}>
                {fallbackSubtitle}
              </Typography>
            </Box>
            {mapLoadState === "error" && canAttemptLiveMap && (
              <Button
                variant="contained"
                startIcon={<SyncRoundedIcon />}
                onClick={() => setMapAttempt((prev) => prev + 1)}
                sx={{
                  mt: 2,
                  px: 3,
                  py: 1,
                  borderRadius: 2,
                  textTransform: "none",
                  fontWeight: 600,
                  boxShadow: "none",
                }}
              >
                Try Again
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {mapLoadState === "ready" && (
        <Box
          sx={{
            position: "absolute",
            bottom: 24,
            left: 24,
            right: 24,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              alignItems: "center",
              backgroundColor: "background.paper",
              px: { xs: 2.5, sm: 3 },
              py: { xs: 1.5, sm: 1.75 },
              borderRadius: 3,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              pointerEvents: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <RoomRoundedIcon sx={{ color: "white", fontSize: 20 }} />
            </Box>
            <Box sx={{ pr: 1 }}>
              <Typography variant="body1" color="text.primary" sx={{ fontWeight: "700", lineHeight: 1.2, mb: 0.5 }}>
                {bus.code}
              </Typography>
              <Typography variant="caption" color="success.main" sx={{ fontWeight: "600", display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "success.main",
                    display: "inline-block",
                  }}
                />
                LIVE TRACKING
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
