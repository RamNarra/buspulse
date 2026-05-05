"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Map as MapIcon, Bus as BusIcon } from "lucide-react";

import { getPublicRuntimeEnv, getSetupStatus } from "@/lib/config/env";
import type { Bus, BusLocation } from "@/types/models";
import type { FleetBus } from "@/hooks/use-fleet-state";
import { useAppStore } from "@/lib/store/app-store";
import { useInterpolatedPosition } from "@/hooks/use-interpolated-position";
import { haversineMeters } from "@/lib/utils/geo";

type BusMapProps = {
  bus: Bus;
  busLocation: BusLocation | null;
  fleet?: FleetBus[];
};

// ── Clustering ────────────────────────────────────────────────────────────────

/**
 * Buses physically within this radius of each other are considered to be the
 * same vehicle (or a convoy) and are merged into a single map marker.
 * 150 m comfortably covers GPS drift AND two buses travelling bumper-to-bumper.
 */
const CLUSTER_RADIUS_M = 150;

type ClusteredBus = FleetBus & {
  /** Additional route numbers merged into this cluster (sorted by pingers desc). */
  mergedRoutes: string[];
};

/**
 * Pure function — groups `fleet` entries that are within `CLUSTER_RADIUS_M`
 * of each other. The cluster representative is always the entry with the most
 * `activePingers` (majority-vote). Merged routes are listed in the badge.
 */
function clusterFleet(fleet: FleetBus[]): ClusteredBus[] {
  // Sort descending by pingers so the most-populated bus wins the cluster label.
  const sorted = [...fleet].sort((a, b) => b.activePingers - a.activePingers);
  const clusters: ClusteredBus[] = [];

  for (const bus of sorted) {
    // Find the nearest existing cluster centroid within CLUSTER_RADIUS_M.
    const nearest = clusters.find(
      (c) => haversineMeters(c.lat, c.lng, bus.lat, bus.lng) <= CLUSTER_RADIUS_M,
    );

    if (nearest) {
      // Merge into the existing cluster — just add the route number to the badge.
      nearest.mergedRoutes.push(bus.routeNumber);
      // Keep the cluster's activePingers up to date (used for info only).
      nearest.activePingers += bus.activePingers;
    } else {
      // New standalone cluster.
      clusters.push({ ...bus, mergedRoutes: [] });
    }
  }

  return clusters;
}

// ── AnimatedBusMarker ─────────────────────────────────────────────────────────
// Each cluster gets its own component instance so that `useInterpolatedPosition`
// can manage one RAF animation loop per marker independently.
function AnimatedBusMarker({
  fleetBus,
  isCurrentRoute,
  mergedRoutes = [],
}: {
  fleetBus: FleetBus;
  isCurrentRoute: boolean;
  mergedRoutes?: string[];
}) {
  const target = {
    lat: fleetBus.lat,
    lng: fleetBus.lng,
    heading: undefined as number | undefined,
    updatedAt: fleetBus.updatedAt,
  };
  const pos = useInterpolatedPosition(target);

  if (!pos) return null;

  const isMerged = mergedRoutes.length > 0;

  return (
    <AdvancedMarker
      key={fleetBus.routeNumber}
      position={{ lat: pos.lat, lng: pos.lng }}
      title={
        isMerged
          ? `Route ${fleetBus.routeNumber} (+${mergedRoutes.join(", ")})`
          : `Route ${fleetBus.routeNumber}`
      }
      zIndex={50}
    >
      <div
        className="relative group"
        style={{
          opacity: fleetBus.estimated ? 0.5 : 1,
          transition: "opacity 0.5s",
          transform: pos.heading != null ? `rotate(${pos.heading}deg)` : undefined,
        }}
      >
        {/* Route number label (counter-rotated so it stays readable) */}
        <div
          className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap"
          style={{ transform: pos.heading != null ? `rotate(-${pos.heading}deg)` : undefined }}
        >
          Route {fleetBus.routeNumber}{fleetBus.estimated ? " ~" : ""}
          {isMerged && (
            <span className="ml-1 text-[9px] font-semibold text-amber-300 opacity-80">
              +{mergedRoutes.join("+")}
            </span>
          )}
        </div>

        {/* Bus icon chip */}
        <div
          className={`text-slate-900 rounded-xl p-2 shadow-xl border-2 ${
            fleetBus.estimated ? "border-dashed border-amber-400/60" : "border-white"
          } ${isCurrentRoute ? "bg-indigo-400" : "bg-amber-400"}`}
        >
          <BusIcon className="w-5 h-5" />
        </div>

        {/* Merged-convoy badge (bottom-right corner of the chip) */}
        {isMerged && (
          <div className="absolute -bottom-1 -right-1 bg-slate-900 text-amber-300 text-[8px] font-black px-1 rounded-full border border-amber-400/40 leading-tight">
            {mergedRoutes.length + 1}
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

function MapCentering({ 
  userLocation 
}: { 
  userLocation: { lat: number; lng: number } | null 
}) {
  const map = useMap();
  const hasCenteredOnUserRef = useRef(false);
  const recenterTick = useAppStore((state) => state.recenterTick);

  useEffect(() => {
    if (!map) return;
    
    // @ts-expect-error Expose map for E2E tests
    window._test_mapCenter = map;

    // Initial center on user once
    if (userLocation && !hasCenteredOnUserRef.current) {
      map.panTo(userLocation);
      map.setZoom(15);
      hasCenteredOnUserRef.current = true;
    }
  }, [map, userLocation]);

  // Handle manual recenter trigger
  useEffect(() => {
    if (map && userLocation && recenterTick > 0) {
      map.panTo(userLocation);
      map.setZoom(16);
    }
  }, [map, userLocation, recenterTick]);

  return null;
}

export function BusMap({ bus, busLocation, fleet = [] }: BusMapProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const mapType = useAppStore((state) => state.mapType);

  const setup = getSetupStatus();
  const mapsKey = getPublicRuntimeEnv().NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const canAttemptLiveMap = setup.mapsReady && mapsKey.length > 0;

  const busLat = busLocation?.lat ?? 17.506;
  const busLng = busLocation?.lng ?? 78.382;

  // Cluster nearby bus markers — majority-vote labelling for clubbed buses.
  const clusteredFleet = useMemo(() => clusterFleet(fleet), [fleet]);

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

  if (!canAttemptLiveMap) {
    return (
      <div className="w-full h-full relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm">
              <MapIcon className="w-8 h-8 text-blue-600" />
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-100 text-blue-700">
              Preview
            </span>
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Map preview mode</h3>
              <p className="text-sm text-slate-600 max-w-xs mx-auto">
                Live tiles are not configured. Tracking details remain active below.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950">
      <APIProvider apiKey={mapsKey} onLoad={() => {}}>
        <Map
          defaultZoom={15}
          defaultCenter={{ lat: busLat, lng: busLng }}
          mapId="buspulse-map-id"
          disableDefaultUI={true}
          gestureHandling="greedy"
          colorScheme="DARK"
          mapTypeId={mapType}
        >
          {clusteredFleet.map((clusterBus) => (
            <AnimatedBusMarker
              key={clusterBus.routeNumber}
              fleetBus={clusterBus}
              isCurrentRoute={
                clusterBus.routeNumber === bus.code ||
                clusterBus.mergedRoutes.includes(bus.code)
              }
              mergedRoutes={clusterBus.mergedRoutes}
            />
          ))}

          {/* Your own location — blue dot */}
          {userLocation && (
            <AdvancedMarker 
              position={userLocation} 
              title="Your Location"
              zIndex={100}
            >
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md relative">
                <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75"></div>
              </div>
            </AdvancedMarker>
          )}

          <MapCentering 
            userLocation={userLocation} 
          />
        </Map>
      </APIProvider>
    </div>
  );
}
