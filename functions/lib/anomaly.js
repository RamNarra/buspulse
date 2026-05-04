"use strict";
// ── Anomaly detection — scheduled Cloud Function (Phase 2.4) ─────────────────
// Runs every 1 minutes. Reads all busLocations + busHealth from RTDB,
// fetches route polylines from Firestore (cached 5 min in-process), and
// classifies each bus as healthy / degraded / stale / deviated / stranded / ghost.
// Writes updated busHealth.status back to RTDB via Admin SDK.
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
exports.detectAnomalies = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const anomaly_math_1 = require("./anomaly-math");
// ── In-process route cache ────────────────────────────────────────────────────
const ROUTE_CACHE_TTL_MS = 5 * 60000;
const routeCache = new Map();
async function getRouteCached(routeId) {
    const fs = admin.firestore();
    const hit = routeCache.get(routeId);
    if (hit && Date.now() - hit.ts < ROUTE_CACHE_TTL_MS)
        return hit.doc;
    try {
        const snap = await fs.collection("routes").doc(routeId).get();
        if (!snap.exists)
            return null;
        const doc = snap.data();
        routeCache.set(routeId, { doc, ts: Date.now() });
        return doc;
    }
    catch {
        return null;
    }
}
// ── Per-bus stationary and deviation timers ───────────────────────────────────
// Persist across warm container invocations; reset when the container recycles.
const stationarySince = {};
const deviatedSince = {};
// ── Scheduled function ────────────────────────────────────────────────────────
exports.detectAnomalies = (0, scheduler_1.onSchedule)({ schedule: "every 1 minutes", region: "asia-southeast1" }, async () => {
    const db = admin.database();
    const fs = admin.firestore();
    const now = Date.now();
    // 1. Read all current bus locations + health
    const [locSnap, healthSnap] = await Promise.all([
        db.ref("busLocations").get(),
        db.ref("busHealth").get(),
    ]);
    if (!locSnap.exists())
        return;
    const allLocations = locSnap.val();
    const allHealth = healthSnap.exists()
        ? healthSnap.val()
        : {};
    // 2. Read bus→routeId mapping from Firestore (to find polylines)
    const busToRoute = {};
    try {
        const busSnap = await fs.collection("buses").get();
        for (const doc of busSnap.docs) {
            const d = doc.data();
            if (d.routeId)
                busToRoute[doc.id] = d.routeId;
        }
    }
    catch {
        // Non-fatal — proceed without polylines
    }
    // 3. Read all route stops for stop-proximity checks
    const allStops = {};
    try {
        const stopSnap = await fs.collection("stops").get();
        for (const doc of stopSnap.docs) {
            const d = doc.data();
            if (!allStops[d.routeId])
                allStops[d.routeId] = [];
            allStops[d.routeId].push({ lat: d.lat, lng: d.lng, bufferMeters: d.bufferMeters ?? 100 });
        }
    }
    catch {
        // Non-fatal
    }
    const updates = {};
    for (const busId in allLocations) {
        const loc = allLocations[busId];
        const prevHealth = allHealth[busId];
        if (!prevHealth)
            continue;
        // Do not clobber an offline marker written by the aggregator
        const baseStatus = prevHealth.status;
        const speedMs = loc.speed ?? 0;
        const routeId = busToRoute[busId];
        // ── Polyline deviation ─────────────────────────────────────────────
        let distToRouteM = Infinity;
        if (routeId) {
            const route = await getRouteCached(routeId);
            if (route?.polyline && route.polyline.length >= 2) {
                distToRouteM = (0, anomaly_math_1.perpDistToPolyline)(loc, route.polyline);
            }
        }
        if (distToRouteM < 250) {
            deviatedSince[busId] = null;
        }
        else if (deviatedSince[busId] === null || deviatedSince[busId] === undefined) {
            deviatedSince[busId] = now;
        }
        // ── Stranded check ─────────────────────────────────────────────────
        if (speedMs > 0.5) {
            stationarySince[busId] = null;
        }
        else if (stationarySince[busId] === null || stationarySince[busId] === undefined) {
            stationarySince[busId] = now;
        }
        // Determine if bus is near a stop
        const routeStops = (routeId ? allStops[routeId] : undefined) ?? [];
        const nearStop = routeStops.some((s) => (0, anomaly_math_1.perpDistToPolyline)(loc, [s, s]) < s.bufferMeters ||
            Math.hypot(loc.lat - s.lat, loc.lng - s.lng) < s.bufferMeters / 111111);
        // ── Classify ───────────────────────────────────────────────────────
        const elapsed = (t) => t != null ? now - t : null;
        const newStatus = (0, anomaly_math_1.classifyAnomaly)(baseStatus, prevHealth.lastDerivedAt, speedMs, distToRouteM, elapsed(stationarySince[busId]), elapsed(deviatedSince[busId]), nearStop, now);
        if (newStatus !== baseStatus) {
            const note = newStatus === "ghost"
                ? "No active contributors for > 5 minutes."
                : newStatus === "stranded"
                    ? "Bus stationary > 10 min at non-stop location."
                    : newStatus === "deviated"
                        ? `Bus ${Math.round(distToRouteM)} m off route for > 60 s.`
                        : prevHealth.note ?? "";
            updates[busId] = { ...prevHealth, status: newStatus, note };
        }
    }
    if (Object.keys(updates).length === 0)
        return;
    // Batch write updated health records
    const patch = {};
    for (const busId in updates) {
        patch[`busHealth/${busId}`] = updates[busId];
    }
    await db.ref().update(patch);
});
//# sourceMappingURL=anomaly.js.map