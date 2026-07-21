import { describe, it, expect } from 'vitest';
import { calculateAdaptiveEpsilon } from '@/lib/live/clustering';
import { evaluateContributorReputation, filterReputableCandidates } from '@/lib/live/reputation';
import { replayGpsTripLog, GpsLogPoint } from '@/scripts/replay-gps-log';

describe('Field Validation & Telemetry Engine', () => {
  describe('Adaptive Epsilon', () => {
    it('expands epsilon under degraded GPS accuracy', () => {
      const degradedCandidates = [
        { lat: 17.4000, lng: 78.5000, accuracy: 40 },
        { lat: 17.4001, lng: 78.5001, accuracy: 40 },
      ];
      const eps = calculateAdaptiveEpsilon(degradedCandidates);
      expect(eps).toBe(80); // 40m * 2
    });

    it('tightens epsilon under high precision GPS accuracy', () => {
      const highPrecCandidates = [
        { lat: 17.4000, lng: 78.5000, accuracy: 5 },
        { lat: 17.4001, lng: 78.5001, accuracy: 5 },
      ];
      const eps = calculateAdaptiveEpsilon(highPrecCandidates);
      expect(eps).toBe(30); // capped at minimum base epsilon 30m
    });
  });

  describe('Contributor Reputation', () => {
    it('increases reputation score for valid, cluster-conforming fixes', () => {
      const rep = evaluateContributorReputation(undefined, true, true, 1000);
      expect(rep.score).toBe(0.55);
      expect(rep.validContributions).toBe(1);
    });

    it('penalizes reputation score for invalid/stray fixes', () => {
      const rep = evaluateContributorReputation({ opaqueId: 'user1', score: 0.5, totalContributions: 1, validContributions: 1, lastUpdated: 1000 }, false, false, 2000);
      expect(rep.score).toBe(0.25);
    });

    it('filters out candidates from low-reputation sensors', () => {
      const candidates = [
        { id: 'goodSensor', lat: 17.4000, lng: 78.5000 },
        { id: 'badSensor', lat: 17.4000, lng: 78.5000 },
      ];
      const reputations = {
        goodSensor: { opaqueId: 'goodSensor', score: 0.95, totalContributions: 100, validContributions: 98, lastUpdated: 1000 },
        badSensor: { opaqueId: 'badSensor', score: 0.20, totalContributions: 20, validContributions: 2, lastUpdated: 1000 },
      };

      const filtered = filterReputableCandidates(candidates, reputations, 0.35);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('goodSensor');
    });
  });

  describe('GPS Log Replay Benchmark', () => {
    it('replays multi-sensor GPS trip logs and produces field metrics', () => {
      const tripLog: GpsLogPoint[] = [
        { sensorId: 's1', timestamp: 1000, lat: 17.4000, lng: 78.5000, speed: 8.0, accuracy: 10 },
        { sensorId: 's2', timestamp: 1000, lat: 17.4001, lng: 78.5001, speed: 8.0, accuracy: 10 },
        { sensorId: 's1', timestamp: 2000, lat: 17.4008, lng: 78.5000, speed: 8.5, accuracy: 10 },
        { sensorId: 's2', timestamp: 2000, lat: 17.4009, lng: 78.5001, speed: 8.5, accuracy: 10 },
      ];

      const res = replayGpsTripLog(tripLog);
      expect(res.totalFrames).toBe(2);
      expect(res.validClusterFrames).toBe(2);
      expect(res.avgConfidenceScore).toBeGreaterThan(70);
    });
  });
});
