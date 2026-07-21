import { describe, it, expect } from 'vitest';
import {
  evaluateSensorStatus,
  minDistanceToPolylineMeters,
  distanceToSegmentMeters,
} from '@/lib/live/off-route-detector';

describe('off-route-detector', () => {
  const routePolyline = [
    { lat: 17.4000, lng: 78.5000 },
    { lat: 17.4050, lng: 78.5000 },
    { lat: 17.4100, lng: 78.5000 },
  ];

  describe('distanceToSegmentMeters', () => {
    it('returns 0 when point is directly on segment', () => {
      const dist = distanceToSegmentMeters(
        17.4025, 78.5000,
        17.4000, 78.5000,
        17.4050, 78.5000
      );
      expect(dist).toBeCloseTo(0, 1);
    });

    it('returns perpendicular distance when point is offset from segment', () => {
      // Offset by ~0.001 deg longitude (~100m)
      const dist = distanceToSegmentMeters(
        17.4025, 78.5010,
        17.4000, 78.5000,
        17.4050, 78.5000
      );
      expect(dist).toBeGreaterThan(80);
      expect(dist).toBeLessThan(120);
    });
  });

  describe('minDistanceToPolylineMeters', () => {
    it('calculates minimum distance to route corridor', () => {
      const distOnRoute = minDistanceToPolylineMeters(17.4025, 78.5000, routePolyline);
      expect(distOnRoute).toBeCloseTo(0, 1);

      const distOffRoute = minDistanceToPolylineMeters(17.4025, 78.5050, routePolyline);
      expect(distOffRoute).toBeGreaterThan(400);
    });
  });

  describe('evaluateSensorStatus', () => {
    it('recommends disconnect when user is far off-route (>150m)', () => {
      const result = evaluateSensorStatus({
        location: { lat: 17.4025, lng: 78.5030 }, // ~300m off
        routePath: routePolyline,
        maxCorridorMeters: 150,
      });

      expect(result.disconnect).toBe(true);
      expect(result.reason).toBe('OFF_ROUTE');
    });

    it('keeps sensor active when user is within corridor (<150m)', () => {
      const result = evaluateSensorStatus({
        location: { lat: 17.4025, lng: 78.5005 }, // ~50m off
        routePath: routePolyline,
        maxCorridorMeters: 150,
      });

      expect(result.disconnect).toBe(false);
    });

    it('recommends disconnect when destination stop is reached (<50m)', () => {
      const destinationStop = { lat: 17.4100, lng: 78.5000 };
      const result = evaluateSensorStatus({
        location: { lat: 17.4098, lng: 78.5000 }, // ~20m from destination
        routePath: routePolyline,
        destinationStop,
        destinationRadiusMeters: 50,
      });

      expect(result.disconnect).toBe(true);
      expect(result.reason).toBe('REACHED_DESTINATION');
    });
  });
});
