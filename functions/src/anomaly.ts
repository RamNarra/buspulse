// ── Anomaly detection — scheduled Cloud Function (Phase 2.4) ─────────────────
// Runs every 30 seconds. Reads all busLocations + busHealth from RTDB,
// fetches route polylines from Firestore (cached 5 min in-process), and
// classifies each bus as healthy / degraded / stale / deviated / stranded / ghost.
// Writes updated busHealth.status back to RTDB via Admin SDK.

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { perpDistToPolyline, classifyAnomaly } from "./anomaly-math";
import type { BusHealth, BusHealthStatus, BusLocation, RouteDoc } from "./models";

const db = admin.database();
const fs = admin.firestore();

// ── In-process route cache ────────────────────────────────────────────────────
const ROUTE_CACHE_TTL_MS = 5 * 60_000;
const routeCache = new Map<string, { doc: RouteDoc; ts: number }>();

async function getRouteCached(routeId: string): Promise<RouteDoc | null> {
  const hit = routeCache.get(routeId);
  if (hit && Date.now() - hit.ts < ROUTE_CACHE_TTL_MS) return hit.doc;
  try {
    const snap = await fs.collection("routes").doc(routeId).get();
    if (!snap.exists) return null;
    const doc = snap.data() as RouteDoc;
    routeCache.set(routeId, { doc, ts: Date.now() });
    return doc;
  } catch {
    return null;
  }
}

// ── Per-bus stationary and deviation timers ───────────────────────────────────
// Persist across warm container invocations; reset when the container recycles.
const stationarySince: Record<string, number | null> = {};
const deviatedSince: Record<string, number | null> = {};

// ── Scheduled function ────────────────────────────────────────────────────────

export const detectAnomalies = onSchedule(
  { schedule: "every 30 seconds", region: "asia-south1" },
  async () => {
    const now = Date.now();

    // 1. Read all current bus locations + health
    const [locSnap, healthSnap] = await Promise.all([
      db.ref("busLocations").get(),
      db.ref("busHealth").get(),
    ]);

    if (!locSnap.exists()) return;

    const allLocations = locSnap.val() as Record<string, BusLocation>;
    const allHealth = healthSnap.exists()
      ? (healthSnap.val() as Record<string, BusHealth>)
      : {};

    // 2. Read bus→routeId mapping from Firestore (to find polylines)
    const busToRoute: Record<string, string> = {};
    try {
      const busSnap = await fs.collection("buses").get();
      for (const doc of busSnap.docs) {
        const d = doc.data() as { routeId?: string };
        if (d.routeId) busToRoute[doc.id] = d.routeId;
      }
    } catch {
      // Non-fatal — proceed without polylines
    }

    // 3. Read all route stops for stop-proximity checks
    const allStops: Record<string, Array<{ lat: number; lng: number; bufferMeters: number }>> = {};
    try {
      const stopSnap = await fs.collection("stops").get();
      for (const doc of stopSnap.docs) {
        const d = doc.data() as { routeId: string; lat: number; lng: number; bufferMeters?: number };
        if (!allStops[d.routeId]) allStops[d.routeId] = [];
        allStops[d.routeId].push({ lat: d.lat, lng: d.lng, bufferMeters: d.bufferMeters ?? 100 });
      }
    } catch {
      // Non-fatal
    }

    const updates: Record<string, BusHealth> = {};

    for (const busId in allLocations) {
      const loc = allLocations[busId];
      const prevHealth = allHealth[busId];
      if (!prevHealth) continue;

      // Do not clobber an offline marker written by the aggregator
      const baseStatus = prevHealth.status as BusHealthStatus;

      const speedMs = loc.speed ?? 0;
      const routeId = busToRoute[busId];

      // ── Polyline deviation ─────────────────────────────────────────────
      let distToRouteM = Infinity;
      if (routeId) {
        const route = await getRouteCached(routeId);
        if (route?.polyline && route.polyline.length >= 2) {
          distToRouteM = perpDistToPolyline(loc, route.polyline);
        }
      }

      if (distToRouteM < 250) {
        deviatedSince[busId] = null;
      } else if (deviatedSince[busId] === null || deviatedSince[busId] === undefined) {
        deviatedSince[busId] = now;
      }

      // ── Stranded check ─────────────────────────────────────────────────
      if (speedMs > 0.5) {
        stationarySince[busId] = null;
      } else if (stationarySince[busId] === null || stationarySince[busId] === undefined) {
        stationarySince[busId] = now;
      }

      // Determine if bus is near a stop
      const routeStops = (routeId ? allStops[routeId] : undefined) ?? [];
      const nearStop = routeStops.some(
        (s) =>
          perpDistToPolyline(loc, [s, s]) < s.bufferMeters ||
          Math.hypot(loc.lat - s.lat, loc.lng - s.lng) < s.bufferMeters / 111_111,
      );

      // ── Classify ───────────────────────────────────────────────────────
      const elapsed = (t: number | null | undefined) =>
        t != null ? now - t : null;

      const newStatus = classifyAnomaly(
        baseStatus,
        prevHealth.lastDerivedAt,
        speedMs,
        distToRouteM,
        elapsed(stationarySince[busId]),
        elapsed(deviatedSince[busId]),
        nearStop,
        now,
      );

      if (newStatus !== baseStatus) {
        const note =
          newStatus === "ghost"
            ? "No active contributors for > 5 minutes."
            : newStatus === "stranded"
              ? "Bus stationary > 10 min at non-stop location."
              : newStatus === "deviated"
                ? `Bus ${Math.round(distToRouteM)} m off route for > 60 s.`
                : prevHealth.note ?? "";

        updates[busId] = { ...prevHealth, status: newStatus, note };
      }
    }

    if (Object.keys(updates).length === 0) return;

    // Batch write updated health records
    const patch: Record<string, BusHealth> = {};
    for (const busId in updates) {
      patch[`busHealth/${busId}`] = updates[busId];
    }
    await db.ref().update(patch);
  },
);
