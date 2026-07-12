'use client';

import { useEffect, type ReactNode } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  Polyline,
  useMap,
} from '@vis.gl/react-google-maps';
import { motion } from 'framer-motion';
import type { BusLocation, Stop } from '@/types/models';
import { useAppStore } from '@/lib/store/app-store';

// Dark map style — matches BusPulse design system
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#4a4a5e' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b6b7e' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3a3a4e' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0e0e14' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a28' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f0f1a' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#1e2035' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#12121e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#050510' }],
  },
];

// Type-safe access to google.maps global (loaded async by APIProvider)
type GoogleMapsGlobal = typeof google;
function gm(): GoogleMapsGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as Window & { google?: GoogleMapsGlobal }).google ?? null;
}

interface BusMapProps {
  busLocation: BusLocation | null;
  stops: Stop[];
  userStopId?: string;
  stale?: boolean;
  confidence?: number | null;
  children?: ReactNode;
  className?: string;
}

// Controller defined outside parent to avoid closure warnings
function MapCenteringController({
  busLocation,
  recenterTick,
}: {
  busLocation: BusLocation | null;
  recenterTick: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (map && busLocation) {
      map.panTo({ lat: busLocation.lat, lng: busLocation.lng });
    }
  }, [map, recenterTick, busLocation]);
  return null;
}

export function BusMap({
  busLocation,
  stops,
  userStopId,
  stale = false,
  confidence,
  children,
  className,
}: BusMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const { recenterTick } = useAppStore();

  const defaultCenter =
    busLocation
      ? { lat: busLocation.lat, lng: busLocation.lng }
      : stops[0]
        ? { lat: stops[0].lat, lng: stops[0].lng }
        : { lat: 17.4949, lng: 78.5945 };

  const polylinePath = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const busColor = stale ? '#4a4a5e' : confidence != null && confidence < 0.45 ? '#f59e0b' : '#00c4ff';

  return (
    <motion.div
      className={`relative w-full h-full ${className ?? ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          styles={DARK_MAP_STYLE}
          className="w-full h-full min-h-[300px]"
          reuseMaps
        >
          <MapCenteringController busLocation={busLocation} recenterTick={recenterTick} />
          {polylinePath.length > 1 && (
            <Polyline
              path={polylinePath}
              strokeColor={stale ? '#2a2a3e' : '#00c4ff'}
              strokeOpacity={stale ? 0.4 : 0.7}
              strokeWeight={3}
            />
          )}

          {stops.map((stop) => (
            <Marker
              key={stop.id}
              position={{ lat: stop.lat, lng: stop.lng }}
              title={stop.name}
              icon={gm() ? {
                path: gm()!.maps.SymbolPath.CIRCLE,
                scale: stop.id === userStopId ? 8 : 5,
                fillColor: stop.id === userStopId ? '#00c4ff' : '#fafafa',
                fillOpacity: 1,
                strokeColor: stop.id === userStopId ? 'rgba(0,196,255,0.4)' : '#4a4a5e',
                strokeWeight: stop.id === userStopId ? 3 : 1.5,
              } : undefined}
            />
          ))}

          {busLocation && (
            <Marker
              position={{ lat: busLocation.lat, lng: busLocation.lng }}
              title="Bus"
              icon={gm() ? {
                path: 'M -10,-14 L 10,-14 L 10,10 Q 10,14 6,14 L -6,14 Q -10,14 -10,10 Z',
                fillColor: busColor,
                fillOpacity: 1,
                strokeColor: stale ? '#2a2a3e' : 'rgba(0,196,255,0.4)',
                strokeWeight: 2,
                scale: 1,
                anchor: { x: 0, y: 0 } as google.maps.Point,
              } : undefined}
            />
          )}
        </Map>
      </APIProvider>

      {children}

      {stale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono text-[#f59e0b] bg-[#0f0f12]/90 border border-[#f59e0b]/20 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse inline-block" />
            Signal lost — last known position
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
