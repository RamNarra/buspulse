export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/** Returns distance in metres between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineKm(lat1, lng1, lat2, lng2) * 1000;
}

/**
 * Returns true if a new GPS fix is physically impossible given the elapsed
 * time since the last fix. We cap bus speed at 120 km/h (33.3 m/s).
 * Any ping implying faster-than-that movement is treated as a teleport/outlier.
 */
export function isLocationOutlier(
  prevLat: number,
  prevLng: number,
  prevTs: number,
  newLat: number,
  newLng: number,
  newTs: number,
  maxSpeedMs = 33.3, // 120 km/h in m/s
): boolean {
  const dtSeconds = (newTs - prevTs) / 1000;
  if (dtSeconds <= 0) return false; // same timestamp — allow

  const distMeters = haversineMeters(prevLat, prevLng, newLat, newLng);
  const impliedSpeed = distMeters / dtSeconds;
  return impliedSpeed > maxSpeedMs;
}
