"use strict";
// Mirrors lib/server/anomaly.ts for the Cloud Functions environment.
// Keep in sync when changing detection thresholds.
Object.defineProperty(exports, "__esModule", { value: true });
exports.perpDistToSegment = perpDistToSegment;
exports.perpDistToPolyline = perpDistToPolyline;
exports.classifyAnomaly = classifyAnomaly;
const DEVIATION_THRESHOLD_M = 250;
const DEVIATION_CONFIRM_MS = 60000;
const STRANDED_SPEED_THRESHOLD_MS = 0.5;
const STRANDED_THRESHOLD_MS = 10 * 60000;
const GHOST_THRESHOLD_MS = 5 * 60000;
function toRadians(deg) {
    return (deg * Math.PI) / 180;
}
function haversineM(a, b) {
    const R = 6371000;
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function perpDistToSegment(p, a, b) {
    const ab = haversineM(a, b);
    if (ab < 1)
        return haversineM(p, a);
    const t = ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) /
        ((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2);
    if (t < 0)
        return haversineM(p, a);
    if (t > 1)
        return haversineM(p, b);
    return haversineM(p, { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) });
}
function perpDistToPolyline(p, polyline) {
    if (polyline.length < 2)
        return Infinity;
    let min = Infinity;
    for (let i = 0; i < polyline.length - 1; i++) {
        const d = perpDistToSegment(p, polyline[i], polyline[i + 1]);
        if (d < min)
            min = d;
    }
    return min;
}
function classifyAnomaly(baseStatus, lastDerivedAt, speedMs, distToRouteM, stationarySinceMs, deviatedSinceMs, nearStop, now) {
    // Ghost
    if (now - lastDerivedAt > GHOST_THRESHOLD_MS)
        return "ghost";
    // Stranded
    if (speedMs <= STRANDED_SPEED_THRESHOLD_MS &&
        !nearStop &&
        stationarySinceMs !== null &&
        stationarySinceMs >= STRANDED_THRESHOLD_MS)
        return "stranded";
    // Deviated
    if (distToRouteM >= DEVIATION_THRESHOLD_M &&
        deviatedSinceMs !== null &&
        deviatedSinceMs >= DEVIATION_CONFIRM_MS)
        return "deviated";
    return baseStatus;
}
//# sourceMappingURL=anomaly-math.js.map