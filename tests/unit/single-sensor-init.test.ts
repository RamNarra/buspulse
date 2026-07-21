import { describe, it, expect } from 'vitest';
import { deriveLocationFromCandidates } from '@/lib/live/scoring';

describe('Single-Sensor Bus Tracking & Initialization Engine', () => {
  it('derives valid bus location from a single active contributor', () => {
    const singleCandidate = [
      {
        submittedAt: Date.now(),
        accuracy: 10,
        speed: 8.5,
        routeMatchScore: 1.0,
        lat: 17.4000,
        lng: 78.5000,
        heading: 90,
      },
    ];

    const result = deriveLocationFromCandidates(singleCandidate);
    expect(result).not.toBeNull();
    expect(result?.lat).toBe(17.4000);
    expect(result?.lng).toBe(78.5000);
    expect(result?.sourceCount).toBe(1);
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it('returns null when zero contributors exist (offline state)', () => {
    const emptyCandidates: [] = [];
    const result = deriveLocationFromCandidates(emptyCandidates);
    expect(result).toBeNull();
  });
});
