"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.haversineMeters = haversineMeters;
exports.isLocationOutlier = isLocationOutlier;
function haversineKm(lat1, lng1, lat2, lng2) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
}
/** Returns distance in metres between two lat/lng points. */
function haversineMeters(lat1, lng1, lat2, lng2) {
    return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}
/**
 * Returns true if a new GPS fix is physically impossible given the elapsed
 * time since the last fix. We cap bus speed at 120 km/h (33.3 m/s).
 * Any ping implying faster-than-that movement is treated as a teleport/outlier.
 */
function isLocationOutlier(prevLat, prevLng, prevTs, newLat, newLng, newTs, maxSpeedMs = 33.3) {
    const dtSeconds = (newTs - prevTs) / 1000;
    if (dtSeconds <= 0)
        return false; // same timestamp — allow
    const distMeters = haversineMeters(prevLat, prevLng, newLat, newLng);
    // Natural GPS drift tolerance: never reject points under 40 meters,
    // regardless of how "fast" the time delta makes it seem.
    if (distMeters <= 40)
        return false;
    // Add 10 seconds of "grace time" so consecutive pings from different phones don't artificially spike speed calculation
    return distMeters / (dtSeconds + 10) > maxSpeedMs;
}
//# sourceMappingURL=geo.js.map