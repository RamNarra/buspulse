import { describe, it, expect } from "vitest";
import {
  perpDistToPolyline,
  perpDistToSegment,
  isGhost,
  isStranded,
  isDeviated,
  classifyAnomaly,
} from "@/lib/server/anomaly";

const ROUTE = [
  { lat: 17.40, lng: 78.50 },
  { lat: 17.41, lng: 78.51 },
  { lat: 17.42, lng: 78.52 },
];

describe("perpDistToSegment", () => {
  it("returns ~0 for a point exactly on the segment midpoint", () => {
    const mid = { lat: 17.405, lng: 78.505 };
    expect(perpDistToSegment(mid, ROUTE[0], ROUTE[1])).toBeLessThan(10);
  });
});

describe("perpDistToPolyline", () => {
  it("returns small distance for a point near the midpoint of the route", () => {
    const dist = perpDistToPolyline({ lat: 17.405, lng: 78.505 }, ROUTE);
    expect(dist).toBeLessThan(100);
  });

  it("returns a large distance for a point far from the route", () => {
    const dist = perpDistToPolyline({ lat: 18.0, lng: 80.0 }, ROUTE);
    expect(dist).toBeGreaterThan(100_000);
  });

  it("returns Infinity for fewer than 2 polyline points", () => {
    expect(perpDistToPolyline({ lat: 17.4, lng: 78.5 }, [])).toBe(Infinity);
    expect(perpDistToPolyline({ lat: 17.4, lng: 78.5 }, [ROUTE[0]])).toBe(Infinity);
  });
});

describe("isGhost", () => {
  const now = 1_700_000_000_000;
  it("returns true when last update was >5 min ago", () =>
    expect(isGhost(now - 6 * 60_000, now)).toBe(true));
  it("returns false when last update was recent", () =>
    expect(isGhost(now - 30_000, now)).toBe(false));
});

describe("isStranded", () => {
  it("returns true when slow + not near stop + stationary >10 min", () =>
    expect(isStranded(0.1, 11 * 60_000, false)).toBe(true));
  it("returns false when at a stop", () =>
    expect(isStranded(0.1, 11 * 60_000, true)).toBe(false));
  it("returns false when speed is above threshold", () =>
    expect(isStranded(5, 11 * 60_000, false)).toBe(false));
  it("returns false when stationarySince is null", () =>
    expect(isStranded(0.1, null, false)).toBe(false));
});

describe("isDeviated", () => {
  it("returns true when >250 m off route for >60 s", () =>
    expect(isDeviated(300, 90_000)).toBe(true));
  it("returns false when within 250 m", () =>
    expect(isDeviated(100, 90_000)).toBe(false));
  it("returns false when deviatedSince is null", () =>
    expect(isDeviated(300, null)).toBe(false));
});

describe("classifyAnomaly", () => {
  const now = 1_700_000_000_000;

  it("returns ghost when last update > 5 min ago", () => {
    expect(
      classifyAnomaly("healthy", now - 6 * 60_000, 8, 50, null, null, false, now)
    ).toBe("ghost");
  });

  it("returns stranded when slow + >10 min + not near stop", () => {
    expect(
      classifyAnomaly("healthy", now - 5_000, 0.1, 50, 11 * 60_000, null, false, now)
    ).toBe("stranded");
  });

  it("returns deviated when off-route >250 m for >60 s", () => {
    expect(
      classifyAnomaly("healthy", now - 5_000, 8, 300, null, 90_000, false, now)
    ).toBe("deviated");
  });

  it("returns base status when no anomaly", () => {
    expect(
      classifyAnomaly("degraded", now - 5_000, 8, 50, null, null, false, now)
    ).toBe("degraded");
  });
});
