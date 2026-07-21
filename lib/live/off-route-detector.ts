import { haversineMeters } from '../utils/geo';

export interface RoutePoint {
  lat: number;
  lng: number;
}

/**
 * Calculates the shortest distance in meters from a point (P) to a line segment (AB).
 */
export function distanceToSegmentMeters(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const distA = haversineMeters(pLat, pLng, aLat, aLng);
  const segmentLength = haversineMeters(aLat, aLng, bLat, bLng);

  if (segmentLength < 1) {
    return distA;
  }

  const dx = bLng - aLng;
  const dy = bLat - aLat;
  const t = Math.max(
    0,
    Math.min(1, ((pLng - aLng) * dx + (pLat - aLat) * dy) / (dx * dx + dy * dy)),
  );

  const projLat = aLat + t * dy;
  const projLng = aLng + t * dx;

  return haversineMeters(pLat, pLng, projLat, projLng);
}

/**
 * Calculates the minimum distance in meters from a location fix to a route polyline.
 */
export function minDistanceToPolylineMeters(
  lat: number,
  lng: number,
  polyline: RoutePoint[],
): number {
  if (!polyline || polyline.length === 0) {
    return 0; // If no polyline available, assume on-route
  }

  if (polyline.length === 1) {
    return haversineMeters(lat, lng, polyline[0].lat, polyline[0].lng);
  }

  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegmentMeters(
      lat,
      lng,
      polyline[i].lat,
      polyline[i].lng,
      polyline[i + 1].lat,
      polyline[i + 1].lng,
    );
    if (d < minDistance) {
      minDistance = d;
    }
  }

  return minDistance;
}

export interface SensorCheckOptions {
  location: RoutePoint;
  routePath?: RoutePoint[];
  destinationStop?: RoutePoint;
  maxCorridorMeters?: number;
  destinationRadiusMeters?: number;
}

export interface DisconnectEvaluation {
  disconnect: boolean;
  reason?: 'OFF_ROUTE' | 'REACHED_DESTINATION' | 'MANUAL_OPT_OUT';
  distanceFromRouteMeters?: number;
}

/**
 * Evaluates whether a crowdsourcing sensor should automatically stop contributing.
 */
export function evaluateSensorStatus(
  options: SensorCheckOptions,
): DisconnectEvaluation {
  const {
    location,
    routePath = [],
    destinationStop,
    maxCorridorMeters = 150,
    destinationRadiusMeters = 50,
  } = options;

  // Check destination arrival first
  if (destinationStop) {
    const distToDest = haversineMeters(
      location.lat,
      location.lng,
      destinationStop.lat,
      destinationStop.lng,
    );
    if (distToDest <= destinationRadiusMeters) {
      return {
        disconnect: true,
        reason: 'REACHED_DESTINATION',
        distanceFromRouteMeters: distToDest,
      };
    }
  }

  // Check route corridor deviation if polyline is provided
  if (routePath.length > 0) {
    const distFromRoute = minDistanceToPolylineMeters(
      location.lat,
      location.lng,
      routePath,
    );
    if (distFromRoute > maxCorridorMeters) {
      return {
        disconnect: true,
        reason: 'OFF_ROUTE',
        distanceFromRouteMeters: distFromRoute,
      };
    }
    return {
      disconnect: false,
      distanceFromRouteMeters: distFromRoute,
    };
  }

  return { disconnect: false };
}
