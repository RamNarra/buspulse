"use client";

import { useEffect, useState, useRef } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Map as MapIcon, MapPin } from "lucide-react";

import { getPublicRuntimeEnv, getSetupStatus } from "@/lib/config/env";
import type { Bus, BusLocation } from "@/types/models";
import { useAppStore } from "@/lib/store/app-store";

type BusMapProps = {
  bus: Bus;
  busLocation: BusLocation | null;
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

export function BusMap({ bus, busLocation }: BusMapProps) {
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
      <div className="w-full h-full relative rounded-none md:rounded-3xl overflow-hidden bg-[#dce5f4]">
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
    <div className="w-full h-full relative rounded-none md:rounded-3xl overflow-hidden bg-[#dce5f4]">
      <APIProvider apiKey={mapsKey} onLoad={() => {}}>
        <Map
          defaultZoom={15}
          defaultCenter={{ lat: busLat, lng: busLng }}
          mapId="buspulse-map-id"
          disableDefaultUI={true}
          gestureHandling="greedy"
          colorScheme="LIGHT"
          mapTypeId={mapType}
        >
          <AdvancedMarker 
            position={{ lat: busLat, lng: busLng }} 
            title={bus.code}
          >
            <div className="bg-blue-600 text-white rounded-full p-2 shadow-lg border-2 border-white">
              <MapPin className="w-5 h-5" />
            </div>
          </AdvancedMarker>

          {userLocation && (
            <AdvancedMarker 
              position={userLocation} 
              title="Your Location"
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

      <div className="absolute bottom-6 left-6 right-6 flex justify-center pointer-events-none">
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-lg pointer-events-auto border border-slate-200">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-inner">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div className="pr-2">
            <p className="text-base font-bold text-slate-900 leading-tight mb-1">{bus.code}</p>
            <p className="text-xs font-bold text-green-600 flex items-center gap-1.5 uppercase tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
              Live Tracking
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
