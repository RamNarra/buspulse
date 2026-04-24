"use client";

import { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Map as MapIcon, MapPin, Bus as BusIcon } from "lucide-react";

import { getPublicRuntimeEnv, getSetupStatus } from "@/lib/config/env";
import type { Bus, BusLocation } from "@/types/models";
import type { FleetBus } from "@/hooks/use-fleet-state";
import { useAppStore } from "@/lib/store/app-store";

type BusMapProps = {
  bus: Bus;
  busLocation: BusLocation | null;
  fleet?: FleetBus[];
};

function MapCentering({ 
  userLocation 
}: { 
  userLocation: { lat: number; lng: number } | null 
}) {
  const map = useMap();
  const hasCenteredOnUserRef = useRef(false);

  useEffect(() => {
    if (!map) return;
    
    // @ts-expect-error Expose map for E2E tests
    window._test_mapCenter = map;

    if (userLocation && !hasCenteredOnUserRef.current) {
      map.panTo(userLocation);
      hasCenteredOnUserRef.current = true;
    }
  }, [map, userLocation]);

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
          {fleet.map((fleetBus) => (
            <AdvancedMarker 
              key={fleetBus.routeNumber}
              position={{ lat: fleetBus.lat, lng: fleetBus.lng }} 
              title={`Route ${fleetBus.routeNumber}`}
              zIndex={50}
            >
              <div className="relative group" style={{ opacity: fleetBus.estimated ? 0.5 : 1, transition: "opacity 0.5s" }}>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                  Route {fleetBus.routeNumber}{fleetBus.estimated ? " ~" : ""}
                </div>
                <div className={`text-slate-900 rounded-xl p-2 shadow-xl border-2 ${fleetBus.estimated ? "border-dashed border-amber-400/60" : "border-white"} ${fleetBus.routeNumber === bus.code ? "bg-indigo-400" : "bg-amber-400"}`}>
                  <BusIcon className="w-5 h-5" />
                </div>
              </div>
            </AdvancedMarker>
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
