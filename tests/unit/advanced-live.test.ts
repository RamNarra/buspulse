import { describe, it, expect } from 'vitest';
import { createKalmanFilter, updateKalmanState, predictKalmanState } from '@/lib/live/kalman';
import { findLargestSpatialCluster } from '@/lib/live/clustering';
import { calculateBoardingConfidence } from '@/lib/live/confidence-boarding';

describe('Advanced Live Spatial Engine', () => {
  describe('Kalman Filter', () => {
    it('initializes with default variance and coordinates', () => {
      const state = createKalmanFilter(17.4000, 78.5000, 1000);
      expect(state.lat).toBe(17.4000);
      expect(state.lng).toBe(78.5000);
      expect(state.vLat).toBe(0);
    });

    it('predicts position after elapsed time delta', () => {
      const state = createKalmanFilter(17.4000, 78.5000, 1000);
      state.vLat = 0.0001; // moving north
      const predicted = predictKalmanState(state, 2000); // 1s later
      expect(predicted.lat).toBeCloseTo(17.4001, 4);
    });

    it('updates position and reduces variance with GPS measurement', () => {
      const initial = createKalmanFilter(17.4000, 78.5000, 1000);
      const updated = updateKalmanState(initial, 17.4002, 78.5002, 10, 2000);
      expect(updated.variance).toBeLessThan(initial.variance);
      expect(updated.lat).toBeGreaterThan(17.4000);
    });
  });

  describe('DBSCAN Spatial Clustering', () => {
    it('groups co-located devices and separates isolated outliers', () => {
      const candidates = [
        { id: 'dev1', lat: 17.4000, lng: 78.5000 },
        { id: 'dev2', lat: 17.4001, lng: 78.5001 }, // ~15m away
        { id: 'dev3', lat: 17.4002, lng: 78.5002 }, // ~30m away
        { id: 'spoofer', lat: 17.5000, lng: 78.9000 }, // ~40km away (spoofed)
      ];

      const { primaryCluster, outliers } = findLargestSpatialCluster(candidates, 50, 2);
      expect(primaryCluster.length).toBe(3);
      expect(outliers.length).toBe(1);
      expect(outliers[0].id).toBe('spoofer');
    });
  });

  describe('Multi-Factor Boarding Confidence', () => {
    const routePolyline = [
      { lat: 17.4000, lng: 78.5000 },
      { lat: 17.4100, lng: 78.5000 },
    ];

    it('returns isBoarded=true when confidence score >= 80', () => {
      const result = calculateBoardingConfidence({
        location: { lat: 17.4050, lng: 78.5001 }, // on route (~10m)
        speedMs: 8.5, // ~30 km/h (bus speed)
        routePath: routePolyline,
        peerCount: 3,
        accuracyMeters: 10,
      });

      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.isBoarded).toBe(true);
    });

    it('returns isBoarded=false when user is walking or far off-route', () => {
      const result = calculateBoardingConfidence({
        location: { lat: 17.4050, lng: 78.5100 }, // ~1 km off route
        speedMs: 1.0, // walking speed (~3.6 km/h)
        routePath: routePolyline,
        peerCount: 0,
        accuracyMeters: 30,
      });

      expect(result.score).toBeLessThan(80);
      expect(result.isBoarded).toBe(false);
    });
  });
});
