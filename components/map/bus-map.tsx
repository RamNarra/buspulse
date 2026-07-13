'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, NavigationArrow, Speedometer, Clock, Info } from '@phosphor-icons/react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { BusLocation, Stop } from '@/types/models';
import { useAppStore } from '@/lib/store/app-store';
import { haversineMeters } from '@/lib/utils/geo';

interface BusMapProps {
  busLocation: BusLocation | null;
  stops: Stop[];
  userStopId?: string;
  stale?: boolean;
  confidence?: number | null;
  children?: ReactNode;
  className?: string;
}

// MapLibre Satellite Style Configuration using ESRI World Imagery
const SATELLITE_MAP_STYLE = {
  version: 8 as const,
  sources: {
    'satellite-tiles': {
      type: 'raster' as const,
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  },
  layers: [
    {
      id: 'satellite',
      type: 'raster' as const,
      source: 'satellite-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

function getHeadingText(deg?: number | null): string {
  if (deg === undefined || deg === null) return '—';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8;
  return directions[idx];
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const busMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const { recenterTick } = useAppStore();

  const [selectedBus, setSelectedBus] = useState<{
    id: string;
    lat: number;
    lng: number;
    speed?: number | null;
    heading?: number | null;
    updatedAt: number;
    isMerged?: boolean;
  } | null>(null);

  const defaultCenter: [number, number] = busLocation
    ? [busLocation.lng, busLocation.lat]
    : stops[0]
      ? [stops[0].lng, stops[0].lat]
      : [78.5945, 17.4949];

  // 1. Geolocation tracker for User Location Pointer
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

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

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 2. Initialize MapLibre GL Map (Satellite Mode)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: SATELLITE_MAP_STYLE,
      center: defaultCenter,
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    // Handle manual pan / drag to pause auto-following
    map.on('dragstart', () => {
      setIsFollowingUser(false);
    });

    mapRef.current = map;

    // Load path and map layers once style loads
    map.on('load', () => {
      const pathCoordinates = stops.map((s) => [s.lng, s.lat]);
      if (pathCoordinates.length > 1) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: pathCoordinates,
            },
          },
        });

        // neon cyan polyline path
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': stale ? '#4a4a5e' : '#00c4ff',
            'line-width': 4,
            'line-opacity': stale ? 0.5 : 0.9,
          },
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Synchronize stops markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    stops.forEach((stop) => {
      const isUserStop = stop.id === userStopId;

      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center';
      
      const dot = document.createElement('div');
      dot.className = 'rounded-full border transition-all duration-300';
      dot.style.width = isUserStop ? '14px' : '10px';
      dot.style.height = isUserStop ? '14px' : '10px';
      dot.style.backgroundColor = isUserStop ? '#00c4ff' : '#1a1a1f';
      dot.style.borderColor = isUserStop ? '#ffffff' : '#252532';
      if (isUserStop) {
        dot.style.boxShadow = '0 0 12px #00c4ff';
      }

      el.appendChild(dot);

      const label = document.createElement('div');
      label.className = 'absolute top-full mt-1.5 text-[9px] font-mono text-[#8b8b9e] bg-[#0f0f12]/90 border border-[#1e1e28] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none';
      label.textContent = stop.name;
      el.appendChild(label);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);

      stopMarkersRef.current.push(marker);
    });
  }, [stops, userStopId]);

  // 4. Synchronize user and bus markers with proximity merging
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isMerged = !!(
      userLocation &&
      busLocation &&
      haversineMeters(userLocation.lat, userLocation.lng, busLocation.lat, busLocation.lng) <= 45
    );

    // Handle User Location Marker
    if (userLocation && !isMerged) {
      if (!userMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'relative w-4 h-4 rounded-full bg-[#3b82f6] border-2 border-white shadow-md flex items-center justify-center';
        
        const ping = document.createElement('div');
        ping.className = 'absolute inset-0 rounded-full bg-[#60a5fa] animate-ping opacity-75 pointer-events-none';
        el.appendChild(ping);

        userMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([userLocation.lng, userLocation.lat])
          .addTo(map);
      } else {
        userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      }
    } else {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    }

    // Handle Bus/Merged Marker
    if (busLocation) {
      const busColor = stale
        ? '#4a4a5e'
        : confidence != null && confidence < 0.45
        ? '#f59e0b'
        : '#00c4ff';
      const busBorder = isMerged ? '#3b82f6' : '#ffffff';
      const glowShadow = isMerged
        ? '0 0 20px rgba(59,130,246,0.8), 0 0 10px rgba(0,196,255,0.5)'
        : stale
        ? 'none'
        : '0 0 16px rgba(0,196,255,0.5)';

      const updatePinContent = (pin: HTMLDivElement) => {
        if (isMerged) {
          pin.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#0a0a0b" viewBox="0 0 256 256">
              <path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z" opacity="0.2"></path>
              <path d="M232,128a104,104,0,1,0-104,104A104.11,104.11,0,0,0,232,128Zm-192,0a88,88,0,1,1,88,88A88.1,88.1,0,0,1,40,128Z"></path>
            </svg>
            <span class="text-[8px] font-extrabold uppercase tracking-tight -mt-0.5">YOU</span>
          `;
        } else {
          pin.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="#0a0a0b" viewBox="0 0 256 256">
              <path d="M200,24H56A24,24,0,0,0,32,48v80a8,8,0,0,0,8,8h8v64a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V184h64v16a16,16,0,0,0,16,16h16a16,16,0,0,0,16-16V144h8a8,8,0,0,0,8-8V48A24,24,0,0,0,200,24Z" opacity="0.2"></path>
              <path d="M200,24H56A24,24,0,0,0,32,48v80a8,8,0,0,0,8,8h8v64a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V184h64v16a16,16,0,0,0,16,16h16a16,16,0,0,0,16-16V144h8a8,8,0,0,0,8-8V48A24,24,0,0,0,200,24ZM48,48a8,8,0,0,1,8-8H200a8,8,0,0,1,8,8v40H48ZM192,200H176V184h16Zm-96,0H80V184H96Zm112-72H48v-8H208Zm0-24H48V88H208Z"></path>
            </svg>
            <span class="text-[8px] font-extrabold uppercase tracking-tight -mt-0.5">BUS</span>
          `;
        }
      };

      if (!busMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'relative flex items-center justify-center cursor-pointer';
        
        const pin = document.createElement('div');
        pin.className = 'w-9 h-9 rounded-lg flex flex-col items-center justify-center border font-bold text-[9px] text-[#0a0a0b] shadow-xl transition-all duration-300';
        pin.style.backgroundColor = busColor;
        pin.style.borderColor = busBorder;
        pin.style.boxShadow = glowShadow;

        updatePinContent(pin);
        el.appendChild(pin);

        // Click handler to open the info card
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedBus({
            id: 'bus-a1',
            lat: busLocation.lat,
            lng: busLocation.lng,
            speed: busLocation.speed,
            heading: busLocation.heading,
            updatedAt: busLocation.updatedAt || Date.now(),
            isMerged,
          });

          // Smoothly pan to selected bus
          map.easeTo({
            center: [busLocation.lng, busLocation.lat],
            duration: 500,
          });
        });

        busMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([busLocation.lng, busLocation.lat])
          .addTo(map);
      } else {
        busMarkerRef.current.setLngLat([busLocation.lng, busLocation.lat]);
        const pin = busMarkerRef.current.getElement().querySelector('div');
        if (pin) {
          pin.style.backgroundColor = busColor;
          pin.style.borderColor = busBorder;
          pin.style.boxShadow = glowShadow;
          updatePinContent(pin);
        }
      }
    } else {
      if (busMarkerRef.current) {
        busMarkerRef.current.remove();
        busMarkerRef.current = null;
      }
    }
  }, [busLocation, userLocation, stale, confidence]);

  // 5. Update info card state when bus position moves in real time
  useEffect(() => {
    if (selectedBus && busLocation) {
      setSelectedBus((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          lat: busLocation.lat,
          lng: busLocation.lng,
          speed: busLocation.speed,
          heading: busLocation.heading,
          updatedAt: busLocation.updatedAt || Date.now(),
        };
      });
    }
  }, [busLocation, selectedBus]);

  // 6. Smooth real-time camera tracking (Follow Mode)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isFollowingUser || !userLocation) return;

    map.easeTo({
      center: [userLocation.lng, userLocation.lat],
      duration: 500,
    });
  }, [userLocation, isFollowingUser]);

  // 7. Recenter handler
  useEffect(() => {
    if (recenterTick === 0) return;
    const map = mapRef.current;
    if (!map) return;

    setIsFollowingUser(true);

    const targetCoords = userLocation ?? busLocation ?? (stops[0] ? { lat: stops[0].lat, lng: stops[0].lng } : null);
    if (targetCoords) {
      map.easeTo({
        center: [targetCoords.lng, targetCoords.lat],
        duration: 800,
        zoom: 15,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterTick]);

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] bg-[#0a0a0b]" />
      
      {/* Floating active open-source mapping badge */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono text-[#00c4ff] bg-[#0a0a0b]/80 border border-[#00c4ff]/20 backdrop-blur-md pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00c4ff] animate-pulse" />
        <span>MAPLIBRE SATELLITE ACTIVE</span>
      </div>

      {/* Real-time floating info card for selected bus */}
      <AnimatePresence>
        {selectedBus && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-4 left-4 z-30 w-[280px] p-4 rounded-xl text-[#fafafa] flex flex-col gap-3.5 shadow-2xl border border-[#252532]"
            style={{
              background: 'rgba(15,15,18,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono text-[#8b8b9e] tracking-wider uppercase">Live Telemetry</span>
                <h3 className="text-sm font-semibold text-[#fafafa] flex items-center gap-1.5">
                  <span>Route 15 Campus Express</span>
                  {selectedBus.isMerged && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                      ONBOARDED
                    </span>
                  )}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBus(null)}
                className="p-1 rounded hover:bg-[#1a1a1f] text-[#8b8b9e] hover:text-[#fafafa] transition-colors"
                aria-label="Close details"
              >
                <X size={14} />
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#1a1a1f]/60 border border-[#252532]/40">
                <Speedometer size={16} className="text-[#00c4ff]" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#8b8b9e] uppercase font-mono">Speed</span>
                  <span className="font-semibold text-sm">
                    {selectedBus.speed ? `${Math.round(selectedBus.speed * 3.6)} km/h` : '0 km/h'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#1a1a1f]/60 border border-[#252532]/40">
                <NavigationArrow size={16} className="text-[#00c4ff]" style={{ transform: `rotate(${(selectedBus.heading ?? 0) - 45}deg)` }} />
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#8b8b9e] uppercase font-mono">Heading</span>
                  <span className="font-semibold text-sm">
                    {getHeadingText(selectedBus.heading)} ({(selectedBus.heading ?? 0)}°)
                  </span>
                </div>
              </div>
            </div>

            {/* Footer timestamp */}
            <div className="flex items-center justify-between text-[10px] text-[#4a4a5e] border-t border-[#1e1e28] pt-2.5 mt-0.5">
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>Last Ping: {new Date(selectedBus.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <div className="flex items-center gap-1 text-[#00c4ff]">
                <Info size={12} />
                <span className="font-mono">Live GPS</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {children}

      {stale && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono text-[#f59e0b] bg-[#0f0f12]/90 border border-[#f59e0b]/20 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse inline-block" />
            Signal lost — last known position
          </div>
        </motion.div>
      )}
    </div>
  );
}
