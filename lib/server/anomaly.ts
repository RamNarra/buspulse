// ── Anomaly detection math (Phase 2.4) ───────────────────────────────────────
// Pure functions — no I/O. Used by both the Cloud Function scheduler and any
// future Server Action that needs to surface anomaly state.

export type LatLng = { lat: number; lng: number };

export type AnomalyStatus =
  | "healthy"
  | "degraded"
  | "stale"
  | "deviated"
  | "stranded"
  | "ghost"
  | "offline";

// ── Constants ─────────────────────────────────────────────────────────────────
const DEVIATION_THRESHOLD_M = 250;
const DEVIATION_CONFIRM_MS = 60_000;
const STRANDED_SPEED_THRESHOLD_MS = 0.5; // m/s ≈ 1.8 km/h
const STRANDED_THRESHOLD_MS = 10 * 60_000; // 10 min
const GHOST_THRESHOLD_MS = 5 * 60_000; // 5 min

// ── Geometry helpers ──────────────────────────────────────────────────────────

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Perpendicular distance (metres) from point P to the infinite line through
 * segment A→B. Falls back to min(dist(P,A), dist(P,B)) when the segment
 * is degenerate (A === B).
 */
export function perpDistToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const ab = haversineM(a, b);
  if (ab < 1) return haversineM(p, a); // degenerate segment

  // Project onto segment using dot product in flat (lat/lng) space.
  // This is an approximation valid for short segments (< ~50 km).
  const t =
    ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) /
    ((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2);

  if (t < 0) return haversineM(p, a);
  if (t > 1) return haversineM(p, b);

  const proj: LatLng = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return haversineM(p, proj);
}

/**
 * Minimum perpendicular distance (metres) from point P to any segment in
 * the given polyline. Returns Infinity when polyline has fewer than 2 points.
 */
export function perpDistToPolyline(p: LatLng, polyline: LatLng[]): number {
  if (polyline.length < 2) return Infinity;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = perpDistToSegment(p, polyline[i], polyline[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// ── Anomaly classifiers ───────────────────────────────────────────────────────

/**
 * Ghost: no live contributor data for longer than GHOST_THRESHOLD_MS.
 */
export function isGhost(lastDerivedAt: number, now: number): boolean {
  return now - lastDerivedAt > GHOST_THRESHOLD_MS;
}

/**
 * Stranded: moving at very low speed for longer than STRANDED_THRESHOLD_MS,
 * and not at a known stop.
 */
export function isStranded(
  speedMs: number,
  stationarySinceMs: number | null,
  nearStop: boolean,
): boolean {
  if (nearStop) return false;
  if (speedMs > STRANDED_SPEED_THRESHOLD_MS) return false;
  if (stationarySinceMs === null) return false;
  return stationarySinceMs >= STRANDED_THRESHOLD_MS;
}

/**
 * Deviated: farther than DEVIATION_THRESHOLD_M from the nearest route
 * polyline segment for longer than DEVIATION_CONFIRM_MS.
 */
export function isDeviated(
  distToRouteM: number,
  deviatedSinceMs: number | null,
): boolean {
  if (distToRouteM < DEVIATION_THRESHOLD_M) return false;
  if (deviatedSinceMs === null) return false;
  return deviatedSinceMs >= DEVIATION_CONFIRM_MS;
}

/**
 * Classify a bus given its current live stats.
 *
 * Returns the most severe anomaly found, falling through to the base
 * signal-quality status (healthy / degraded / stale / offline) when no
 * spatial anomaly is detected.
 *
 * @param baseStatus         Signal-quality status from the aggregator
 * @param lastDerivedAt      Timestamp of last aggregator write
 * @param speedMs            Current smoothed speed (m/s)
 * @param distToRouteM       Perpendicular distance to nearest route segment (m)
 * @param stationarySinceMs  How long the bus has been near-stationary, or null
 * @param deviatedSinceMs    How long the bus has been off-route, or null
 * @param nearStop           Whether the bus is within bufferMeters of a stop
 * @param now                Current timestamp
 */
export function classifyAnomaly(
  baseStatus: AnomalyStatus,
  lastDerivedAt: number,
  speedMs: number,
  distToRouteM: number,
  stationarySinceMs: number | null,
  deviatedSinceMs: number | null,
  nearStop: boolean,
  now: number,
): AnomalyStatus {
  if (isGhost(lastDerivedAt, now)) return "ghost";
  if (isStranded(speedMs, stationarySinceMs, nearStop)) return "stranded";
  if (isDeviated(distToRouteM, deviatedSinceMs)) return "deviated";
  return baseStatus;
}
