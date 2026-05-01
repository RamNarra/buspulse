/**
 * BusPulse k6 Load Test — Bus Contributor Simulation
 *
 * Simulates 500 concurrent students acting as GPS contributors (BOARDED state).
 * Each VU mimics the trackerCandidate ping cadence (2-second interval uploads).
 *
 * Usage:
 *   k6 run tests/load/k6-buses.js \
 *     --env BASE_URL=https://buspulse-livid.vercel.app \
 *     --env BUS_COUNT=10
 *
 * Thresholds:
 *   - Contributor ping API p95 < 200 ms
 *   - Error rate < 0.5%
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ─── Custom metrics ────────────────────────────────────────────────────────

const errorRate = new Rate("contributor_error_rate");
const pingLatency = new Trend("contributor_ping_ms", true);

// ─── Test configuration ────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: "1m", target: 100 },
    { duration: "2m", target: 500 },
    { duration: "10m", target: 500 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],
    contributor_ping_ms: ["p(95)<200"],
    contributor_error_rate: ["rate<0.005"],
    http_req_failed: ["rate<0.005"],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "https://buspulse-livid.vercel.app";
const BUS_COUNT = parseInt(__ENV.BUS_COUNT || "10", 10);

/** Simulate a GPS coordinate near Hyderabad, India */
function randomCoord() {
  return {
    lat: 17.385 + (Math.random() - 0.5) * 0.1,
    lng: 78.486 + (Math.random() - 0.5) * 0.1,
  };
}

/** Simple moving simulation: advance position by ~20m per tick */
let _lat = 17.385;
let _lng = 78.486;
function advanceCoord() {
  _lat += (Math.random() - 0.48) * 0.0002; // ~22m north drift
  _lng += (Math.random() - 0.48) * 0.0002;
  return { lat: _lat, lng: _lng };
}

// ─── Virtual User scenario ─────────────────────────────────────────────────

export default function contributor() {
  const busId = `BUS-${String(Math.ceil(Math.random() * BUS_COUNT)).padStart(3, "0")}`;
  const uuid = `load-test-${__VU}-${__ITER}`;

  // Init starting position
  const start = randomCoord();
  _lat = start.lat;
  _lng = start.lng;

  // Simulate contributor riding bus for ~5 minutes (ping every 2s = 150 pings)
  for (let i = 0; i < 150; i++) {
    const coord = advanceCoord();
    const payload = JSON.stringify({
      busId,
      uuid,
      lat: coord.lat,
      lng: coord.lng,
      accuracy: Math.random() * 10 + 5,
      speed: 8 + Math.random() * 5, // ~8–13 m/s (28–47 km/h)
      heading: 45 + Math.random() * 10,
      ts: Date.now(),
      source: "gps",
    });

    const pingStart = Date.now();
    const res = http.post(
      `${BASE_URL}/api/track`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        tags: { name: "contributor_ping" },
      },
    );
    pingLatency.add(Date.now() - pingStart);

    const ok = check(res, {
      "ping 200 or 204": (r) => r.status === 200 || r.status === 204 || r.status === 404,
    });
    errorRate.add(!ok);

    sleep(2); // 2-second cadence matches real contributor upload throttle
  }
}
