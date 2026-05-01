import { describe, it, expect } from "vitest";
import { estimateEtaMinutes, confidenceLabel } from "@/lib/live/eta";
import type { BusLocation, Stop } from "@/types/models";

const now = Date.now();

function makeLoc(overrides: Partial<BusLocation> = {}): BusLocation {
  return {
    lat: 17.4,
    lng: 78.5,
    accuracy: 10,
    speed: 8.33, // ~30 km/h in m/s
    heading: 90,
    sourceCount: 1,
    updatedAt: now,
    confidence: 0.9,
    routeMatchScore: 0.9,
    ...overrides,
  };
}

function makeStop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: "stop1",
    routeId: "route42",
    name: "Main Gate",
    order: 1,
    lat: 17.41,  // ~1.1 km from 17.4
    lng: 78.5,
    bufferMeters: 100,
    ...overrides,
  };
}

describe("estimateEtaMinutes", () => {
  it("returns at least 1 minute", () => {
    const loc = makeLoc({ lat: 17.4099, lng: 78.5 }); // very close
    const stop = makeStop();
    expect(estimateEtaMinutes(loc, stop)).toBeGreaterThanOrEqual(1);
  });

  it("returns a reasonable ETA for 1 km at 30 km/h (~2 min)", () => {
    const loc = makeLoc(); // ~1.1 km to stop
    const eta = estimateEtaMinutes(loc, makeStop());
    expect(eta).toBeGreaterThanOrEqual(1);
    expect(eta).toBeLessThanOrEqual(5);
  });

  it("uses default speed when speed is 0", () => {
    const loc = makeLoc({ speed: 0 });
    const eta = estimateEtaMinutes(loc, makeStop());
    expect(eta).toBeGreaterThanOrEqual(1);
  });

  it("returns a larger ETA when bus is further away", () => {
    const close = estimateEtaMinutes(makeLoc({ lat: 17.405, lng: 78.5 }), makeStop());
    const far   = estimateEtaMinutes(makeLoc({ lat: 17.0, lng: 78.5 }), makeStop());
    expect(far).toBeGreaterThan(close);
  });
});

describe("confidenceLabel", () => {
  it("returns High for >= 0.75", () => expect(confidenceLabel(0.8)).toBe("High"));
  it("returns Medium for >= 0.45 and < 0.75", () => expect(confidenceLabel(0.6)).toBe("Medium"));
  it("returns Low for < 0.45", () => expect(confidenceLabel(0.2)).toBe("Low"));
});
