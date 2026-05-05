"use strict";
// ── Geo utilities (mirrors lib/utils/geo.ts) ─────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.haversineMeters = haversineMeters;
exports.isLocationOutlier = isLocationOutlier;
function haversineKm(lat1, lng1, lat2, lng2) {
    const toRadians = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function haversineMeters(lat1, lng1, lat2, lng2) {
    return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}
/**
 * Returns true if the new fix implies a speed greater than `maxSpeedMs` m/s —
 * i.e., the ping is physically impossible and should be rejected as an outlier.
 */
function isLocationOutlier(prevLat, prevLng, prevTs, newLat, newLng, newTs, maxSpeedMs = 33.3) {
    const dtSeconds = (newTs - prevTs) / 1000;
    if (dtSeconds <= 0)
        return false;
    const distMeters = haversineMeters(prevLat, prevLng, newLat, newLng);
    // Natural GPS drift tolerance: never reject points under 40 meters,
    // regardless of how "fast" the time delta makes it seem.
    if (distMeters <= 40)
        return false;
    // Add 10 seconds of "grace time" so consecutive pings from different phones don't artificially spike speed calculate
    return distMeters / (dtSeconds + 10) > maxSpeedMs;
}
//# sourceMappingURL=geo.js.map