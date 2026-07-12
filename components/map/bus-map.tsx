'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  Polyline,
  useMap,
} from '@vis.gl/react-google-maps';
import { motion } from 'framer-motion';
import { MapPin, Warning } from '@phosphor-icons/react';
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
    stylers: [{ color: '#141420' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#05070a' }],
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

// Sleek fallback schematic when Google Maps key auth fails
function MapAuthFallback({
  stops,
  busLocation,
  userStopId,
  stale,
  children,
}: {
  stops: Stop[];
  busLocation: BusLocation | null;
  userStopId?: string;
  stale: boolean;
  children?: ReactNode;
}) {
  const busColor = stale ? '#4a4a5e' : '#00c4ff';
  const busBorder = stale ? '#2a2a3e' : '#22d3ee';
  const glowShadow = stale ? 'none' : '0 0 16px rgba(6,182,212,0.3)';
  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0a0b] flex flex-col items-center justify-center p-6 bg-dot-grid">
      {/* Background cybernetic grid lines */}
      <div className="absolute inset-0 bg-radial-glow pointer-events-none opacity-40" />

      {/* Cybernetic schematic route overlay */}
      <div className="w-full max-w-xl aspect-[1.8/1] relative flex items-center justify-center z-10 border border-[#1e1e28] rounded-[12px] bg-[#0f0f12]/80 backdrop-blur-md p-8 shadow-2xl">
        {stops.length > 0 ? (
          <div className="w-full flex items-center justify-between relative py-12">
            {/* Connection path line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-[#1e1e28] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                className="h-full bg-gradient-to-r from-[#00c4ff] to-[#0088cc]"
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </div>

            {stops.map((stop, index) => {
              const isUserStop = stop.id === userStopId;
              const isClosest =
                busLocation &&
                stops.reduce<{ index: number; dist: number }>(
                  (acc, s, idx) => {
                    const dist = Math.hypot(busLocation.lat - s.lat, busLocation.lng - s.lng);
                    return dist < acc.dist ? { index: idx, dist } : acc;
                  },
                  { index: 0, dist: Infinity }
                ).index === index;

              return (
                <div key={stop.id} className="flex flex-col items-center relative z-10">
                  {/* Glowing stop nodes */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="w-5 h-5 rounded-full flex items-center justify-center border shadow-lg"
                    style={{
                      background: isUserStop ? '#00c4ff' : '#1a1a1f',
                      borderColor: isUserStop ? '#00c4ff' : '#252532',
                      boxShadow: isUserStop ? '0 0 12px rgba(0,196,255,0.4)' : 'none',
                    }}
                  >
                    {isUserStop && <MapPin size={10} color="#0a0a0b" weight="fill" />}
                  </motion.div>
                  <span className="text-[10px] font-mono text-[#8b8b9e] mt-2 absolute top-full w-24 text-center truncate">
                    {stop.name}
                  </span>

                  {/* Pulsing Bus Node overlay on the closest stop */}
                  {isClosest && (
                    <motion.div
                      layoutId="fallback-bus"
                      className="absolute -top-10 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-colors duration-300"
                      style={{
                        background: busColor,
                        borderColor: busBorder,
                        borderWidth: '1px',
                        boxShadow: glowShadow,
                      }}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    >
                      <span className="text-[10px] font-bold text-[#0a0a0b]">BUS</span>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00c4ff] animate-ping" />
            <p className="text-sm font-mono text-[#8b8b9e]">Synchronizing telemetry stream…</p>
          </div>
        )}
      </div>

      {/* Futuristic telemetry status tag */}
      <div className="mt-8 flex flex-col items-center gap-2 z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-mono text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20">
          <Warning size={12} />
          <span>DEVELOPER MAP EMULATOR ACTIVE · KEY AUTHENTICATION ERROR</span>
        </div>
        <p className="text-xs text-[#4a4a5e] max-w-sm text-center">
          Google Maps failed to authenticate this domain. Core telemetry calculations remain operational below.
        </p>
      </div>

      {children}
    </div>
  );
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
  const [mapAuthFailed, setMapAuthFailed] = useState(false);

  // Monitor Google Maps authorization failure
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as unknown as { gm_authFailure?: () => void };
    const prevHandler = win.gm_authFailure;
    win.gm_authFailure = () => {
      setMapAuthFailed(true);
      if (prevHandler) prevHandler();
    };
    return () => {
      win.gm_authFailure = prevHandler;
    };
  }, []);

  const defaultCenter =
    busLocation
      ? { lat: busLocation.lat, lng: busLocation.lng }
      : stops[0]
        ? { lat: stops[0].lat, lng: stops[0].lng }
        : { lat: 17.4949, lng: 78.5945 };

  const polylinePath = stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  const busColor = stale ? '#4a4a5e' : confidence != null && confidence < 0.45 ? '#f59e0b' : '#00c4ff';

  // Render high-fidelity cybernetic fallback if maps key failed to authenticate or is empty
  if (mapAuthFailed || !apiKey) {
    return (
      <MapAuthFallback
        stops={stops}
        busLocation={busLocation}
        userStopId={userStopId}
        stale={stale}
      >
        {children}
      </MapAuthFallback>
    );
  }

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
