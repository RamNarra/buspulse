// ── Geo utilities (mirrors lib/utils/geo.ts) ─────────────────────────────────

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/**
 * Returns true if the new fix implies a speed greater than `maxSpeedMs` m/s —
 * i.e., the ping is physically impossible and should be rejected as an outlier.
 */
export function isLocationOutlier(
  prevLat: number,
  prevLng: number,
  prevTs: number,
  newLat: number,
  newLng: number,
  newTs: number,
  maxSpeedMs = 33.3, // 120 km/h
): boolean {
  const dtSeconds = (newTs - prevTs) / 1000;
  if (dtSeconds <= 0) return false;
  const distMeters = haversineMeters(prevLat, prevLng, newLat, newLng);
  
  // Natural GPS drift tolerance: never reject points under 40 meters,
  // regardless of how "fast" the time delta makes it seem.
  if (distMeters <= 40) return false;
  
  // Add 10 seconds of "grace time" so consecutive pings from different phones don't artificially spike speed calculate
  return distMeters / (dtSeconds + 10) > maxSpeedMs;
}
