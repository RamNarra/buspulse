import { describe, it, expect } from 'vitest';
import { isAllowedEmail } from '@/lib/firebase/auth';
import { evaluateSensorStatus } from '@/lib/live/off-route-detector';
import { calculateBoardingConfidence } from '@/lib/live/confidence-boarding';
import { deriveLocationFromCandidates } from '@/lib/live/scoring';
import { estimateEtaMinutes } from '@/lib/live/eta';
import { isLiveDataStale } from '@/lib/firebase/realtime';

describe('End-to-End Instrumented Pipeline Execution Trace', () => {
  it('Stage 1: User Identity & Domain Permission Gate', () => {
    const studentEmail = "rahul.23311a6764@sreenidhi.edu.in";
    const allowed = isAllowedEmail(studentEmail);
    expect(allowed).toBe(true);
  });

  it('Stage 2: Off-Route Corridor Protection Engine', () => {
    const routePath = [
      { lat: 17.4931, lng: 78.3914 },
      { lat: 17.4935, lng: 78.3910 },
      { lat: 17.5150, lng: 78.3742 },
      { lat: 17.5369, lng: 78.3577 },
    ];

    // On-route GPS ping (~10m from route)
    const onRouteResult = evaluateSensorStatus({
      location: { lat: 17.4932, lng: 78.3913 },
      routePath,
    });
    expect(onRouteResult.disconnect).toBe(false);

    // Off-route GPS ping (~500m off route corridor)
    const offRouteResult = evaluateSensorStatus({
      location: { lat: 17.5500, lng: 78.4200 },
      routePath,
      maxCorridorMeters: 150,
    });
    expect(offRouteResult.disconnect).toBe(true);
    expect(offRouteResult.reason).toBe('OFF_ROUTE');
  });

  it('Stage 3: Multi-Factor Boarding Classification & Transition', () => {
    const routePath = [
      { lat: 17.4931, lng: 78.3914 },
      { lat: 17.5369, lng: 78.3577 },
    ];

    const boardedResult = calculateBoardingConfidence({
      location: { lat: 17.5000, lng: 78.3850 },
      speedMs: 8.0, // Bus traveling ~28.8 km/h
      routePath,
      peerCount: 2,
      accuracyMeters: 12,
    });

    expect(boardedResult.score).toBeGreaterThanOrEqual(80);
    expect(boardedResult.isBoarded).toBe(true);
  });

  it('Stage 4: Single-Sensor & Multi-Sensor Centroid Aggregation', () => {
    const pings = [
      {
        submittedAt: Date.now(),
        accuracy: 10,
        speed: 9.0,
        routeMatchScore: 0.9,
        lat: 17.5000,
        lng: 78.3850,
        heading: 120,
      },
    ];

    const location = deriveLocationFromCandidates(pings);
    expect(location).not.toBeNull();
    expect(location?.lat).toBe(17.5000);
    expect(location?.lng).toBe(78.3850);
  });

  it('Stage 5: Dynamic Traffic-Aware Polyline ETA Calculation', () => {
    const location = {
      lat: 17.4931,
      lng: 78.3914,
      accuracy: 10,
      updatedAt: Date.now(),
      confidence: 0.9,
      sourceCount: 1,
      routeMatchScore: 1.0,
      speed: 2.5, // Heavy traffic (~9 km/h)
    };

    const targetStop = {
      id: "stop-campus",
      routeId: "route-a1",
      name: "Campus",
      order: 4,
      lat: 17.5369,
      lng: 78.3577,
      bufferMeters: 100,
    };

    const stopsPath = [
      { id: "stop-kphb", routeId: "route-a1", name: "KPHB", order: 1, lat: 17.4931, lng: 78.3914, bufferMeters: 100 },
      targetStop,
    ];

    const eta = estimateEtaMinutes(location, targetStop, stopsPath);
    expect(eta).toBeGreaterThan(0);
  });

  it('Stage 6: Realtime Staleness Protection', () => {
    const freshTimestamp = Date.now() - 5_000;
    const staleTimestamp = Date.now() - 120_000;

    expect(isLiveDataStale(freshTimestamp, 90_000)).toBe(false);
    expect(isLiveDataStale(staleTimestamp, 90_000)).toBe(true);
  });
});
