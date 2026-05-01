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

/** How long to dead-reckon after the last live fix (ms) */
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

/**
 * Phase 2.1: Geohash-scoped fleet viewer.
 *
 * Instead of subscribing to the entire `busLocations/` tree, this hook:
 * 1. Encodes the map center into a geohash5 cell.
 * 2. Expands to the 9-cell neighbourhood (center + 8 neighbors ≈ ~15 km radius).
 * 3. Subscribes to `busesByGeohash/{cell}` for each cell → learns which busIds
 *    are in the area.
 * 4. Subscribes to `busLocations/{busId}` for each discovered bus.
 * 5. Unsubscribes from buses that leave all 9 cells.
 *
 * This is O(active_buses_in_viewport) rather than O(all_buses_in_college).
 *
 * Pass `bounds` as the current visible map extent. The hook recomputes cells
 * whenever the center hash changes (i.e., the user pans by ~5 km).
 */
export function useFleetInViewport(bounds: MapBounds | null): { fleet: FleetBus[] } {
  const [fleet, setFleet] = useState<FleetBus[]>([]);

  const physicsRef = useRef<Record<string, BusPhysics>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track active RTDB subscriptions so we can unsubscribe when cells change
  const cellUnsubsRef = useRef<Unsubscribe[]>([]);
  const busUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  const busDataRef = useRef<Map<string, FleetBus>>(new Map());
  const prevCellsRef = useRef<string>("");

  useEffect(() => {
    if (!bounds) return;

    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;
    const centerHash = geohashEncode(centerLat, centerLng, 5);
    const cells = geohash9(centerHash);
    const cellsKey = [...cells].sort().join(",");

    // Only resubscribe if cells actually changed
    if (cellsKey === prevCellsRef.current) return;
    prevCellsRef.current = cellsKey;

    // Tear down all previous subscriptions
    for (const unsub of cellUnsubsRef.current) unsub();
    cellUnsubsRef.current = [];

    // Track which busIds are referenced by the current cells
    const cellBusIds = new Map<string, Set<string>>(); // cell → set<busId>

    function rebuildFleet() {
      const allBusIds = new Set<string>();
      for (const ids of cellBusIds.values()) {
        for (const id of ids) allBusIds.add(id);
      }

      // Subscribe to busLocations for newly appeared buses
      for (const busId of allBusIds) {
        if (!busUnsubsRef.current.has(busId)) {
          const unsub = onValue(ref(db, `busLocations/${busId}`), (snap) => {
            if (!snap.exists()) {
              busDataRef.current.delete(busId);
            } else {
              const loc = snap.val() as {
                lat?: number; lng?: number; updatedAt?: number;
                speed?: number; heading?: number; sourceCount?: number;
              };
              if (
                typeof loc.lat === "number" &&
                typeof loc.lng === "number" &&
                typeof loc.updatedAt === "number"
              ) {
                // Compute dead-reckoning velocity
                const prev = physicsRef.current[busId];
                let dLat = 0, dLng = 0;
                if (prev && prev.updatedAt < loc.updatedAt) {
                  const dt = loc.updatedAt - prev.updatedAt;
                  if (dt > 0) {
                    const vLat = (loc.lat - prev.lat) / dt;
                    const vLng = (loc.lng - prev.lng) / dt;
                    const speedMs = haversineMeters(
                      loc.lat, loc.lng,
                      loc.lat + vLat * 1000, loc.lng + vLng * 1000,
                    );
                    if (speedMs < 33.3) { dLat = vLat; dLng = vLng; }
                  }
                }
                physicsRef.current[busId] = {
                  lat: loc.lat, lng: loc.lng,
                  dlat_per_ms: dLat, dlng_per_ms: dLng,
                  updatedAt: loc.updatedAt,
                  activePingers: loc.sourceCount ?? 1,
                };

                busDataRef.current.set(busId, {
                  routeNumber: busId,
                  lat: loc.lat,
                  lng: loc.lng,
                  activePingers: loc.sourceCount ?? 1,
                  updatedAt: loc.updatedAt,
                  estimated: false,
                });
              }
            }
            setFleet(Array.from(busDataRef.current.values()));
          });
          busUnsubsRef.current.set(busId, unsub);
        }
      }

      // Unsubscribe from buses that left all cells
      for (const [busId, unsub] of busUnsubsRef.current) {
        if (!allBusIds.has(busId)) {
          unsub();
          busUnsubsRef.current.delete(busId);
          busDataRef.current.delete(busId);
          delete physicsRef.current[busId];
        }
      }
      setFleet(Array.from(busDataRef.current.values()));
    }

    // Subscribe to each geohash cell
    for (const cell of cells) {
      cellBusIds.set(cell, new Set());
      const unsub = onValue(ref(db, `busesByGeohash/${cell}`), (snap) => {
        const ids = new Set<string>();
        if (snap.exists()) {
          const data = snap.val() as Record<string, number>;
          for (const busId in data) ids.add(busId);
        }
        cellBusIds.set(cell, ids);
        rebuildFleet();
      });
      cellUnsubsRef.current.push(unsub);
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
          return [...prev.filter((b) => !b.estimated), ...updates.filter((b) => !liveRoutes.has(b.routeNumber))];
        });
      }
    }, DEAD_RECKON_TICK_MS);

    return () => {
      for (const unsub of cellUnsubsRef.current) unsub();
      cellUnsubsRef.current = [];
      for (const unsub of busUnsubsRef.current.values()) unsub();
      busUnsubsRef.current.clear();
      busDataRef.current.clear();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [bounds]);

  return { fleet };
}
