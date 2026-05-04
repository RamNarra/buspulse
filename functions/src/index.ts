import * as admin from "firebase-admin";
import { onValueWritten } from "firebase-functions/v2/database";

import { isLocationOutlier } from "./geo";
import { geohashEncode } from "./geohash";
import { pushCentroid, maybeSnapToRoads } from "./snap-to-roads";
import {
  deriveLocationFromCandidates,
  getHealthStatus,
  isCandidateStale,
} from "./scoring";
import type { BusHealth, BusLocation, TrackerCandidate } from "./models";

export { detectAnomalies } from "./anomaly";
export { exportBusLocationToBigQuery } from "./bigquery-export";
export { notifyApproachingStudents } from "./fcm-notify";

admin.initializeApp();
const db = admin.database();

// ── EMA state store (in-memory, per Cloud Function container instance) ────────
// Survives across warm invocations; decays naturally when the instance recycles.
const EMA_ALPHA = 0.4;
const emaState: Record<
  string,
  { lat: number; lng: number; speed: number }
> = {};

// ── Aggregator function ───────────────────────────────────────────────────────

/**
 * Fires on every write to `trackerCandidates/{busId}/{uuid}`.
 * 1. Reads all current candidates for the bus.
 * 2. Rejects outliers using the previous canonical location as a reference.
 * 3. Derives a weighted centroid via the scoring model.
 * 4. Applies EMA smoothing (α = 0.4) to suppress GPS jitter.
 * 5. Atomically writes the result to `busLocations/{busId}` and
 *    `busHealth/{busId}` using the Admin SDK (only trusted path that can
 *    write to those nodes per database.rules.json).
 */
export const aggregateBusLocation = onValueWritten(
  {
    ref: "trackerCandidates/{busId}/{uuid}",
    region: "asia-southeast1",
  },
  async (event) => {
    const busId = event.params.busId;

    // 1. Read all candidates for this bus in a single round-trip
    const snap = await db.ref(`trackerCandidates/${busId}`).get();
    if (!snap.exists()) {
      // Bus just cleared out — mark offline
      await db.ref(`busHealth/${busId}`).update({
        status: "offline",
        lastDerivedAt: Date.now(),
        note: "No active contributors.",
      });

      try {
        const firestore = admin.firestore();
        await firestore.collection("live_buses").doc(busId).set({
          estimated: true,
          updatedAt: Date.now(),
          activePingers: 0
        }, { merge: true });
      } catch (e) {}

      return;
    }

    const raw = snap.val() as Record<string, unknown>;
    const now = Date.now();

    // 2. Validate and cast candidates
    const candidates: TrackerCandidate[] = Object.values(raw).filter(
      (c): c is TrackerCandidate =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).lat === "number" &&
        typeof (c as Record<string, unknown>).lng === "number" &&
        typeof (c as Record<string, unknown>).submittedAt === "number" &&
        typeof (c as Record<string, unknown>).accuracy === "number",
    );

    // 3. Fetch previous canonical location to use as outlier baseline
    const prevSnap = await db.ref(`busLocations/${busId}`).get();
    const prev: BusLocation | null = prevSnap.exists()
      ? (prevSnap.val() as BusLocation)
      : null;

    // 4. Reject teleport outliers (> 120 km/h implied speed vs. last known fix)
    const filtered = prev
      ? candidates.filter(
          (c) =>
            !isLocationOutlier(
              prev.lat,
              prev.lng,
              prev.updatedAt,
              c.lat,
              c.lng,
              c.submittedAt,
            ),
        )
      : candidates;

    // 5. Derive weighted centroid
    const derived = deriveLocationFromCandidates(filtered, now);
    const staleCandidateCount = filtered.filter((c) =>
      isCandidateStale(c, now),
    ).length;

    if (!derived) {
      const health: Partial<BusHealth> = {
        busId,
        status: "offline",
        activeContributors: 0,
        staleCandidateCount,
        lastDerivedAt: now,
        note: "All candidates are stale or were rejected as outliers.",
      };
      await db.ref(`busHealth/${busId}`).set(health);

      try {
        const firestore = admin.firestore();
        await firestore.collection("live_buses").doc(busId).set({
          estimated: true,
          updatedAt: now,
          activePingers: 0
        }, { merge: true });
      } catch (e) {}

      return;
    }

    // 6. EMA smoothing — blends new reading with previous smoothed position
    const prevEma = emaState[busId];
    if (prevEma) {
      derived.lat = EMA_ALPHA * derived.lat + (1 - EMA_ALPHA) * prevEma.lat;
      derived.lng = EMA_ALPHA * derived.lng + (1 - EMA_ALPHA) * prevEma.lng;
      derived.speed =
        EMA_ALPHA * (derived.speed ?? 0) + (1 - EMA_ALPHA) * prevEma.speed;
    }
    emaState[busId] = {
      lat: derived.lat,
      lng: derived.lng,
      speed: derived.speed ?? 0,
    };

    // 7. Compute health
    const health: BusHealth = {
      busId,
      status: getHealthStatus(derived.confidence, staleCandidateCount),
      activeContributors: filtered.length - staleCandidateCount,
      staleCandidateCount,
      lastDerivedAt: now,
      note: `Derived from ${derived.sourceCount} active signal(s). EMA applied.`,
    };

    // 8. Geohash index (Phase 2.1) — write busesByGeohash/{gh5}/{busId} so
    //    viewers can subscribe to only the cells in their viewport.
    const gh5 = geohashEncode(derived.lat, derived.lng, 5);

    // 8a. Atomic write — only Admin SDK can write here (clients cannot)
    await db.ref().update({
      [`busLocations/${busId}`]:          derived,
      [`busHealth/${busId}`]:             health,
      [`busesByGeohash/${gh5}/${busId}`]: now,
    });

    // 8b. Synchronize with Firestore live_buses for web clients
    try {
      const firestore = admin.firestore();
      await firestore.collection("live_buses").doc(busId).set({
        lat: derived.lat,
        lng: derived.lng,
        speed: derived.speed ?? null,
        heading: derived.heading ?? null,
        activePingers: derived.sourceCount ?? 1,
        estimated: false,
        updatedAt: now
      }, { merge: true });
    } catch (e) {
      console.error(`Failed to sync bus ${busId} to firestore:`, e);
    }

    // 9. Snap-to-roads (Phase 2.2) — fire-and-forget, throttled to 5 s.
    //    Persists snapped path to busPaths/{busId} for the route-line overlay.
    pushCentroid(busId, derived.lat, derived.lng);
    void maybeSnapToRoads(busId, db, now);
  },
);
