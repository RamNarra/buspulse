import { describe, it, expect } from "vitest";
import { isCandidateStale, scoreCandidate, deriveLocationFromCandidates } from "@/lib/live/scoring";
import type { TrackerCandidate } from "@/types/models";

const now = 1_700_000_000_000;

function makeCandidate(overrides: Partial<TrackerCandidate> = {}): TrackerCandidate {
  return {
    uid: "u1",
    busId: "bus42",
    lat: 17.4,
    lng: 78.5,
    accuracy: 10,
    speed: 8,
    heading: 90,
    routeMatchScore: 0.9,
    submittedAt: now - 5_000,
    source: "gps",
    ...overrides,
  };
}

describe("isCandidateStale", () => {
  it("returns false for a fresh candidate (5 s old)", () => {
    expect(isCandidateStale(makeCandidate(), now)).toBe(false);
  });

  it("returns true for a stale candidate (>90 s old)", () => {
    expect(isCandidateStale(makeCandidate({ submittedAt: now - 95_000 }), now)).toBe(true);
  });
});

describe("scoreCandidate", () => {
  it("returns a value between 0 and 1", () => {
    const score = scoreCandidate(makeCandidate(), now);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("fresh + accurate candidate scores higher than stale + inaccurate", () => {
    const high = scoreCandidate(makeCandidate({ accuracy: 5, submittedAt: now - 1_000 }), now);
    const low = scoreCandidate(makeCandidate({ accuracy: 80, submittedAt: now - 25_000 }), now);
    expect(high).toBeGreaterThan(low);
  });
});

describe("deriveLocationFromCandidates", () => {
  it("returns null when no eligible candidates", () => {
    const stale = makeCandidate({ submittedAt: now - 100_000 });
    expect(deriveLocationFromCandidates([stale], now)).toBeNull();
  });

  it("returns a BusLocation with valid lat/lng for one eligible candidate", () => {
    const result = deriveLocationFromCandidates([makeCandidate()], now);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(17.4, 5);
    expect(result!.lng).toBeCloseTo(78.5, 5);
  });

  it("weighted-averages two equal-score candidates at midpoint", () => {
    const c1 = makeCandidate({ lat: 17.0, lng: 78.0, accuracy: 10, routeMatchScore: 0.9 });
    const c2 = makeCandidate({ lat: 18.0, lng: 79.0, accuracy: 10, routeMatchScore: 0.9 });
    const result = deriveLocationFromCandidates([c1, c2], now);
    expect(result!.lat).toBeCloseTo(17.5, 1);
    expect(result!.lng).toBeCloseTo(78.5, 1);
  });

  it("higher-scored candidate dominates position", () => {
    const highScore = makeCandidate({ lat: 17.0, accuracy: 3, submittedAt: now - 1_000 });
    const lowScore = makeCandidate({ lat: 20.0, accuracy: 90, submittedAt: now - 25_000 });
    const result = deriveLocationFromCandidates([highScore, lowScore], now);
    // Position should be much closer to 17.0 than 20.0
    expect(result!.lat).toBeLessThan(18);
  });
});
