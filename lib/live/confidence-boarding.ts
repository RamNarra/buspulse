import { minDistanceToPolylineMeters, RoutePoint } from './off-route-detector';

export interface BoardingConfidenceInput {
  location: RoutePoint;
  speedMs: number;
  routePath?: RoutePoint[];
  peerCount?: number;
  busSpeedMs?: number;
  accuracyMeters?: number;
}

export interface BoardingConfidenceResult {
  score: number; // 0 to 100
  isBoarded: boolean; // true if score >= threshold (default 80)
  breakdown: {
    routeMatch: number; // 0 to 40
    speedMatch: number; // 0 to 20
    clusterAgreement: number; // 0 to 15
    accuracyQuality: number; // 0 to 15
    historyContinuity: number; // 0 to 10
  };
}

/**
 * Multi-Factor Boarding Confidence Score Engine.
 * Evaluates whether a student device is traveling inside the bus with high certainty.
 * Requires a combined score >= 80 to transition state to BOARDED.
 */
export function calculateBoardingConfidence(
  input: BoardingConfidenceInput,
  boardingThreshold = 80,
): BoardingConfidenceResult {
  const {
    location,
    speedMs,
    routePath = [],
    peerCount = 0,
    busSpeedMs = 0,
    accuracyMeters = 15,
  } = input;

  // 1. Route Match Score (0 to 40 pts)
  let routeMatch = 40;
  if (routePath.length > 0) {
    const distM = minDistanceToPolylineMeters(
      location.lat,
      location.lng,
      routePath,
    );
    if (distM > 200) {
      routeMatch = 0;
    } else if (distM > 100) {
      routeMatch = 15;
    } else if (distM > 50) {
      routeMatch = 30;
    } else {
      routeMatch = 40;
    }
  }

  // 2. Speed Match Score (0 to 20 pts)
  let speedMatch = 0;
  // Bus moving speed range: 2 m/s (~7 km/h) to 30 m/s (~108 km/h)
  if (speedMs >= 2 && speedMs <= 30) {
    if (busSpeedMs > 0 && Math.abs(speedMs - busSpeedMs) <= 3) {
      speedMatch = 20; // Excellent velocity match with bus centroid
    } else {
      speedMatch = 15;
    }
  } else if (speedMs >= 0.5) {
    speedMatch = 8;
  }

  // 3. Cluster Agreement Score (0 to 15 pts)
  // More co-moving peers inside bus increases confidence
  let clusterAgreement = 0;
  if (peerCount >= 3) {
    clusterAgreement = 15;
  } else if (peerCount >= 1) {
    clusterAgreement = 10;
  } else if (speedMs >= 3) {
    // Solo rider traveling at bus speed
    clusterAgreement = 5;
  }

  // 4. GPS Accuracy Quality (0 to 15 pts)
  let accuracyQuality = 15;
  if (accuracyMeters > 50) {
    accuracyQuality = 2;
  } else if (accuracyMeters > 25) {
    accuracyQuality = 8;
  } else if (accuracyMeters > 15) {
    accuracyQuality = 12;
  }

  // 5. History Continuity Floor (0 to 10 pts)
  const historyContinuity = speedMs > 1 ? 10 : 5;

  const score = Math.min(
    100,
    routeMatch + speedMatch + clusterAgreement + accuracyQuality + historyContinuity,
  );

  return {
    score,
    isBoarded: score >= boardingThreshold,
    breakdown: {
      routeMatch,
      speedMatch,
      clusterAgreement,
      accuracyQuality,
      historyContinuity,
    },
  };
}
