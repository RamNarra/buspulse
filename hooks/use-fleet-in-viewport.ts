"use client";

import { useEffect, useRef, useState } from "react";
import { getDatabase, ref, onValue, type Unsubscribe } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { geohashEncode, geohash9 } from "@/lib/utils/geohash";
import { haversineMeters } from "@/lib/utils/geo";
import type { FleetBus } from "@/hooks/use-fleet-state";

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

const DEAD_RECKON_MAX_MS = 120_000;
const DEAD_RECKON_TICK_MS = 2_000;

type BusPhysics = {
  lat: number;
  lng: number;
  dlat_per_ms: number;
  dlng_per_ms: number;
  updatedAt: number;
  activePingers: number;
};

export function useFleetInViewport(bounds: MapBounds | null): { fleet: FleetBus[] } {
  const [fleet, setFleet] = useState<FleetBus[]>([]);

  const physicsRef = useRef<Record<string, BusPhysics>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Active subscriptions
  const cellUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  const cellBusIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const busUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  const busDataRef = useRef<Map<string, FleetBus>>(new Map());

  useEffect(() => {
    if (!bounds) return;

    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    const centerHash = geohashEncode(centerLat, centerLng, 5);
    const targetCells = new Set(geohash9(centerHash));

    const activeCellUnsubs = cellUnsubsRef.current;
    const activeCellBusIds = cellBusIdsRef.current;
    const activeBusUnsubs = busUnsubsRef.current;
    const activeBusData = busDataRef.current;

    // 1. Unsubscribe from cells that are no longer needed
    for (const cell of activeCellUnsubs.keys()) {
      if (!targetCells.has(cell)) {
        activeCellUnsubs.get(cell)?.();
        activeCellUnsubs.delete(cell);
        activeCellBusIds.delete(cell);
      }
    }

    function rebuildFleet() {
      const allBusIds = new Set<string>();
      for (const ids of activeCellBusIds.values()) {
        for (const id of ids) {
          allBusIds.add(id);
        }
      }

      // Subscribe to newly discovered buses
      for (const busId of allBusIds) {
        if (!activeBusUnsubs.has(busId)) {
          const unsub = onValue(ref(db, `busLocations/${busId}`), (snap) => {
            if (!snap.exists()) {
              activeBusData.delete(busId);
            } else {
              const loc = snap.val() as {
                lat?: number;
                lng?: number;
                updatedAt?: number;
                speed?: number;
                heading?: number;
                sourceCount?: number;
              };
              if (
                typeof loc.lat === "number" &&
                typeof loc.lng === "number" &&
                typeof loc.updatedAt === "number"
              ) {
                const prev = physicsRef.current[busId];
                let dLat = 0, dLng = 0;
                if (prev && prev.updatedAt < loc.updatedAt) {
                  const dt = loc.updatedAt - prev.updatedAt;
                  if (dt > 0) {
                    const vLat = (loc.lat - prev.lat) / dt;
                    const vLng = (loc.lng - prev.lng) / dt;
                    const speedMs = haversineMeters(
                      loc.lat,
                      loc.lng,
                      loc.lat + vLat * 1000,
                      loc.lng + vLng * 1000,
                    );
                    if (speedMs < 33.3) {
                      dLat = vLat;
                      dLng = vLng;
                    }
                  }
                }
                physicsRef.current[busId] = {
                  lat: loc.lat,
                  lng: loc.lng,
                  dlat_per_ms: dLat,
                  dlng_per_ms: dLng,
                  updatedAt: loc.updatedAt,
                  activePingers: loc.sourceCount ?? 1,
                };

                activeBusData.set(busId, {
                  routeNumber: busId,
                  lat: loc.lat,
                  lng: loc.lng,
                  activePingers: loc.sourceCount ?? 1,
                  updatedAt: loc.updatedAt,
                  estimated: false,
                });
              }
            }
            setFleet(Array.from(activeBusData.values()));
          });
          activeBusUnsubs.set(busId, unsub);
        }
      }

      // Unsubscribe from buses that are no longer in any active cell
      for (const [busId, unsub] of activeBusUnsubs) {
        if (!allBusIds.has(busId)) {
          unsub();
          activeBusUnsubs.delete(busId);
          activeBusData.delete(busId);
          delete physicsRef.current[busId];
        }
      }
      setFleet(Array.from(activeBusData.values()));
    }

    // 2. Subscribe only to new cells
    for (const cell of targetCells) {
      if (!activeCellUnsubs.has(cell)) {
        activeCellBusIds.set(cell, new Set());
        const unsub = onValue(ref(db, `busesByGeohash/${cell}`), (snap) => {
          const ids = new Set<string>();
          if (snap.exists()) {
            const data = snap.val() as Record<string, number>;
            for (const busId in data) {
              ids.add(busId);
            }
          }
          activeCellBusIds.set(cell, ids);
          rebuildFleet();
        });
        activeCellUnsubs.set(cell, unsub);
      }
    }

    // Dead reckoning ticker
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const physics = physicsRef.current;
      const updates: FleetBus[] = [];

      for (const busId in physics) {
        const p = physics[busId];
        const age = now - p.updatedAt;
        if (age < 15_000 || age > DEAD_RECKON_MAX_MS) continue;
        updates.push({
          routeNumber: busId,
          lat: p.lat + p.dlat_per_ms * age,
          lng: p.lng + p.dlng_per_ms * age,
          activePingers: p.activePingers,
          updatedAt: p.updatedAt,
          estimated: true,
        });
      }

      if (updates.length > 0) {
        setFleet((prev) => {
          const liveRoutes = new Set(prev.filter((b) => !b.estimated).map((b) => b.routeNumber));
          return [
            ...prev.filter((b) => !b.estimated),
            ...updates.filter((b) => !liveRoutes.has(b.routeNumber)),
          ];
        });
      }
    }, DEAD_RECKON_TICK_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [bounds]);

  // Cleanup all listeners on unmount
  useEffect(() => {
    const activeCellUnsubs = cellUnsubsRef.current;
    const activeBusUnsubs = busUnsubsRef.current;
    return () => {
      for (const unsub of activeCellUnsubs.values()) unsub();
      activeCellUnsubs.clear();
      for (const unsub of activeBusUnsubs.values()) unsub();
      activeBusUnsubs.clear();
    };
  }, []);

  return { fleet };
}
