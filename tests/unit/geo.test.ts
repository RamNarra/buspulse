import { describe, it, expect } from "vitest";
import { haversineKm, haversineMeters, isLocationOutlier } from "@/lib/utils/geo";

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(17.4, 78.5, 17.4, 78.5)).toBe(0);
  });

  it("returns ~111 km for 1 degree of latitude", () => {
    const km = haversineKm(0, 0, 1, 0);
    expect(km).toBeCloseTo(111.19, 0);
  });

  it("is symmetric", () => {
    const ab = haversineKm(17.4, 78.5, 17.5, 78.6);
    const ba = haversineKm(17.5, 78.6, 17.4, 78.5);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("returns a reasonable distance for Hyderabad→Mumbai (~700 km)", () => {
    const km = haversineKm(17.385, 78.486, 19.076, 72.877);
    expect(km).toBeGreaterThan(600);
    expect(km).toBeLessThan(800);
  });
});

describe("haversineMeters", () => {
  it("is 1000x haversineKm", () => {
    const km = haversineKm(17.4, 78.5, 17.41, 78.51);
    const m = haversineMeters(17.4, 78.5, 17.41, 78.51);
    expect(m).toBeCloseTo(km * 1000, 3);
  });
});

describe("isLocationOutlier", () => {
  const now = Date.now();

  it("returns false for a reasonable update (30 km/h over 10 s)", () => {
    // 30 km/h = 8.3 m/s; 10 s → ~83 m ≈ 0.00075 deg lat
    const result = isLocationOutlier(17.4, 78.5, now - 10_000, 17.4008, 78.5, now);
    expect(result).toBe(false);
  });

  it("returns true for a teleport (500 km in 1 s)", () => {
    const result = isLocationOutlier(17.4, 78.5, now - 1_000, 21.9, 82.1, now);
    expect(result).toBe(true);
  });

  it("returns false for same timestamp regardless of distance", () => {
    const result = isLocationOutlier(17.4, 78.5, now, 21.0, 80.0, now);
    expect(result).toBe(false);
  });
});
