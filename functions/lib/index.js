"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateBusLocation = exports.notifyApproachingStudents = exports.exportBusLocationToBigQuery = exports.detectAnomalies = void 0;
const admin = __importStar(require("firebase-admin"));
const database_1 = require("firebase-functions/v2/database");
const geo_1 = require("./geo");
const geohash_1 = require("./geohash");
const snap_to_roads_1 = require("./snap-to-roads");
const scoring_1 = require("./scoring");
var anomaly_1 = require("./anomaly");
Object.defineProperty(exports, "detectAnomalies", { enumerable: true, get: function () { return anomaly_1.detectAnomalies; } });
var bigquery_export_1 = require("./bigquery-export");
Object.defineProperty(exports, "exportBusLocationToBigQuery", { enumerable: true, get: function () { return bigquery_export_1.exportBusLocationToBigQuery; } });
var fcm_notify_1 = require("./fcm-notify");
Object.defineProperty(exports, "notifyApproachingStudents", { enumerable: true, get: function () { return fcm_notify_1.notifyApproachingStudents; } });
admin.initializeApp();
const db = admin.database();
// ── EMA state store (in-memory, per Cloud Function container instance) ────────
// Survives across warm invocations; decays naturally when the instance recycles.
const EMA_ALPHA = 0.4;
const emaState = {};
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
exports.aggregateBusLocation = (0, database_1.onValueWritten)({
    ref: "trackerCandidates/{busId}/{uuid}",
    region: "asia-southeast1",
}, async (event) => {
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
        }
        catch (e) { }
        return;
    }
    const raw = snap.val();
    const now = Date.now();
    // 2. Validate and cast candidates
    const candidates = Object.values(raw).filter((c) => typeof c === "object" &&
        c !== null &&
        typeof c.lat === "number" &&
        typeof c.lng === "number" &&
        (typeof c.submittedAt === "number" || typeof c.updatedAt === "number"));
    // 3. Fetch previous canonical location to use as outlier baseline
    const prevSnap = await db.ref(`busLocations/${busId}`).get();
    const prev = prevSnap.exists()
        ? prevSnap.val()
        : null;
    // 4. Reject teleport outliers (> 120 km/h implied speed vs. last known fix)
    const filtered = prev
        ? candidates.filter((c) => !(0, geo_1.isLocationOutlier)(prev.lat, prev.lng, prev.updatedAt, c.lat, c.lng, (c.submittedAt || c.updatedAt || Date.now())))
        : candidates;
    // 5. Derive weighted centroid
    const derived = (0, scoring_1.deriveLocationFromCandidates)(filtered, now);
    const staleCandidateCount = filtered.filter((c) => (0, scoring_1.isCandidateStale)(c, now)).length;
    if (!derived) {
        const health = {
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
        }
        catch (e) { }
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
    const health = {
        busId,
        status: (0, scoring_1.getHealthStatus)(derived.confidence, staleCandidateCount),
        activeContributors: filtered.length - staleCandidateCount,
        staleCandidateCount,
        lastDerivedAt: now,
        note: `Derived from ${derived.sourceCount} active signal(s). EMA applied.`,
    };
    // 8. Geohash index (Phase 2.1) — write busesByGeohash/{gh5}/{busId} so
    //    viewers can subscribe to only the cells in their viewport.
    const gh5 = (0, geohash_1.geohashEncode)(derived.lat, derived.lng, 5);
    // 8a. Atomic write — only Admin SDK can write here (clients cannot)
    await db.ref().update({
        [`busLocations/${busId}`]: derived,
        [`busHealth/${busId}`]: health,
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
    }
    catch (e) {
        console.error(`Failed to sync bus ${busId} to firestore:`, e);
    }
    // 9. Snap-to-roads (Phase 2.2) — fire-and-forget, throttled to 5 s.
    //    Persists snapped path to busPaths/{busId} for the route-line overlay.
    (0, snap_to_roads_1.pushCentroid)(busId, derived.lat, derived.lng);
    void (0, snap_to_roads_1.maybeSnapToRoads)(busId, db, now);
});
//# sourceMappingURL=index.js.map