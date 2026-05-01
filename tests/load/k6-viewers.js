/**
 * BusPulse k6 Load Test — Viewer Simulation
 *
 * Simulates 5,000 concurrent viewers polling the live bus endpoint.
 * Models realistic student behaviour: load dashboard → subscribe to bus → watch for 5 min.
 *
 * Usage:
 *   k6 run tests/load/k6-viewers.js \
 *     --env BASE_URL=https://buspulse-livid.vercel.app \
 *     --env BUS_IDS=BUS-001,BUS-002,BUS-003
 *
 * Thresholds (Phase 4 SLOs):
 *   - p95 response < 400 ms
 *   - Error rate < 0.5%
 *   - Sustained 5,000 VUs for 10 minutes
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ─── Custom metrics ────────────────────────────────────────────────────────

const errorRate = new Rate("error_rate");
const etaLatency = new Trend("eta_latency_ms", true);
const dashboardLatency = new Trend("dashboard_latency_ms", true);

// ─── Test configuration ────────────────────────────────────────────────────

export const options = {
  stages: [
    // Ramp up to 1,000 VUs over 2 minutes
    { duration: "2m", target: 1000 },
    // Ramp up to 5,000 VUs over 3 more minutes
    { duration: "3m", target: 5000 },
    // Hold at 5,000 VUs for 10 minutes (SLO test window)
    { duration: "10m", target: 5000 },
    // Ramp down
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    // p95 of all HTTP requests must be under 400 ms
    http_req_duration: ["p(95)<400"],
    // ETA endpoint specifically must be under 400 ms p95
    eta_latency_ms: ["p(95)<400"],
    // Dashboard page load under 1s p95
    dashboard_latency_ms: ["p(95)<1000"],
    // Less than 0.5% errors
    error_rate: ["rate<0.005"],
    // HTTP failures under 0.5%
    http_req_failed: ["rate<0.005"],
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "https://buspulse-livid.vercel.app";
const BUS_IDS = (__ENV.BUS_IDS || "BUS-001,BUS-002,BUS-003").split(",");

function randomBusId() {
  return BUS_IDS[Math.floor(Math.random() * BUS_IDS.length)];
}

// ─── Virtual User scenario ─────────────────────────────────────────────────

export default function viewer() {
  const busId = randomBusId();
  const headers = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-IN,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (BusPulse-LoadTest/1.0)",
  };

  // 1. Load the dashboard page (SSR)
  const dashStart = Date.now();
  const dashRes = http.get(`${BASE_URL}/dashboard`, { headers, tags: { name: "dashboard" } });
  dashboardLatency.add(Date.now() - dashStart);

  const dashOk = check(dashRes, {
    "dashboard 200": (r) => r.status === 200,
    "dashboard has content": (r) => r.body !== null && r.body.length > 0,
  });
  errorRate.add(!dashOk);

  sleep(1);

  // 2. Load the bus live-tracking page
  const busRes = http.get(`${BASE_URL}/bus/${busId}`, {
    headers,
    tags: { name: "bus_page" },
  });

  const busOk = check(busRes, {
    "bus page 200": (r) => r.status === 200,
  });
  errorRate.add(!busOk);

  sleep(1);

  // 3. Poll ETA API (simulates what the client does every 30s)
  const etaStart = Date.now();
  const etaRes = http.get(
    `${BASE_URL}/api/eta/${busId}?stopId=STOP-001`,
    {
      headers: { Accept: "application/json" },
      tags: { name: "eta_api" },
    },
  );
  etaLatency.add(Date.now() - etaStart);

  const etaOk = check(etaRes, {
    "eta 200 or 404": (r) => r.status === 200 || r.status === 404,
    "eta response time": (r) => r.timings.duration < 400,
  });
  errorRate.add(!etaOk);

  // Simulate a viewer watching the bus for ~30s before leaving
  sleep(Math.random() * 15 + 15);
}
