'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { BusLocation, Stop } from '@/types/models';
import { useAppStore } from '@/lib/store/app-store';

interface BusMapProps {
  busLocation: BusLocation | null;
  stops: Stop[];
  userStopId?: string;
  stale?: boolean;
  confidence?: number | null;
  children?: ReactNode;
  className?: string;
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
  const stopMarkersRef = useRef<maplibregl.Marker[]>([]);
  const { recenterTick } = useAppStore();

  const defaultCenter: [number, number] = busLocation
    ? [busLocation.lng, busLocation.lat]
    : stops[0]
      ? [stops[0].lng, stops[0].lat]
      : [78.5945, 17.4949]; // Aurora Campus default coordinates (longitude first in MapLibre)

  // 1. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use OpenFreeMap's public dark style
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: defaultCenter,
      zoom: 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    mapRef.current = map;

    // Load path and map layers once style loads
    map.on('load', () => {
      // Add source for route line
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
            'line-color': stale ? '#2a2a3e' : '#00c4ff',
            'line-width': 4,
            'line-opacity': stale ? 0.4 : 0.85,
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

  // 2. Synchronize stops markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    // Add new markers
    stops.forEach((stop) => {
      const isUserStop = stop.id === userStopId;

      // Custom DOM element for glowing stop nodes
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

      // Label element
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

  // 3. Synchronize bus location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!busLocation) {
      if (busMarkerRef.current) {
        busMarkerRef.current.remove();
        busMarkerRef.current = null;
      }
      return;
    }

    const busColor = stale ? '#4a4a5e' : confidence != null && confidence < 0.45 ? '#f59e0b' : '#00c4ff';
    const busBorder = stale ? '#2a2a3e' : '#ffffff';
    const glowShadow = stale ? 'none' : '0 0 16px rgba(0,196,255,0.5)';

    if (!busMarkerRef.current) {
      // Create custom pulsing bus DOM marker
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center';
      
      const pin = document.createElement('div');
      pin.className = 'w-7 h-7 rounded-lg flex items-center justify-center border font-bold text-[9px] text-[#0a0a0b] shadow-xl transition-all duration-300';
      pin.style.backgroundColor = busColor;
      pin.style.borderColor = busBorder;
      pin.style.boxShadow = glowShadow;
      pin.textContent = 'BUS';

      // Pulse animation ring
      if (!stale) {
        const ring = document.createElement('div');
        ring.className = 'absolute inset-0 rounded-lg animate-ping opacity-30 pointer-events-none';
        ring.style.border = `2px solid ${busColor}`;
        el.appendChild(ring);
      }

      el.appendChild(pin);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([busLocation.lng, busLocation.lat])
        .addTo(map);

      busMarkerRef.current = marker;
    } else {
      // Update existing marker coordinate & color
      busMarkerRef.current.setLngLat([busLocation.lng, busLocation.lat]);
      const pin = busMarkerRef.current.getElement().querySelector('div');
      if (pin) {
        pin.style.backgroundColor = busColor;
        pin.style.borderColor = busBorder;
        pin.style.boxShadow = glowShadow;
      }
    }
  }, [busLocation, stale, confidence]);

  // 4. Center map on busLocation or triggers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (busLocation) {
      map.easeTo({
        center: [busLocation.lng, busLocation.lat],
        duration: 800,
      });
    }
  }, [recenterTick, busLocation]);

  return (
    <div className={`relative w-full h-full ${className ?? ''}`}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] bg-[#0a0a0b]" />
      
      {/* Floating active open-source mapping badge */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono text-[#00c4ff] bg-[#0a0a0b]/80 border border-[#00c4ff]/20 backdrop-blur-md pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00c4ff] animate-pulse" />
        <span>MAPLIBRE GL + OPENFREEMAP ACTIVE</span>
      </div>

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
