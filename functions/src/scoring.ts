// ── Scoring logic (mirrors lib/live/scoring.ts) ───────────────────────────────

import type { BusLocation, BusHealthStatus, TrackerCandidate } from "./models";

const FRESH_WINDOW_MS = 30_000;
const STALE_WINDOW_MS = 90_000;

export function isCandidateStale(candidate: TrackerCandidate, now = Date.now()): boolean {
  return now - (candidate.submittedAt || candidate.updatedAt || Date.now()) > STALE_WINDOW_MS;
}

export function scoreCandidate(candidate: TrackerCandidate, now = Date.now()): number {
  const ageMs = now - (candidate.submittedAt || candidate.updatedAt || Date.now());
  const freshnessScore = Math.max(0, 1 - ageMs / FRESH_WINDOW_MS);
  const accuracyScore = Math.max(0, 1 - (candidate.accuracy || 10) / 100);
  const speedScore = candidate.speed ? Math.min(candidate.speed / 14, 1) : 0.4;
  return (
    freshnessScore * 0.45 +
    accuracyScore * 0.3 +
    (candidate.routeMatchScore || 1) * 0.2 +
    speedScore * 0.05
  );
}

export function deriveLocationFromCandidates(
  candidates: TrackerCandidate[],
  now = Date.now(),
): BusLocation | null {
  const eligible = candidates
    .filter((c) => !isCandidateStale(c, now))
    .map((c) => ({ candidate: c, score: scoreCandidate(c, now) }))
    .sort((a, b) => b.score - a.score);

  if (!eligible.length) return null;

  const top = eligible.slice(0, Math.min(3, eligible.length));
  const total = top.reduce((sum, item) => sum + item.score, 0) || 1;

  const weighted = top.reduce(
    (acc, item) => {
      const w = item.score / total;
      acc.lat += item.candidate.lat * w;
      acc.lng += item.candidate.lng * w;
      acc.accuracy += (item.candidate.accuracy || 10) * w;
      acc.routeMatchScore += (item.candidate.routeMatchScore || 1) * w;
      acc.speed += (item.candidate.speed ?? 0) * w;
      acc.heading += (item.candidate.heading ?? 0) * w;
      return acc;
    },
    { lat: 0, lng: 0, accuracy: 0, routeMatchScore: 0, speed: 0, heading: 0 },
  );

  const confidence = Math.max(
    0,
    Math.min(1, top.reduce((sum, item) => sum + item.score, 0) / top.length),
  );

  return {
    lat: weighted.lat,
    lng: weighted.lng,
    heading: weighted.heading,
    speed: weighted.speed,
    accuracy: weighted.accuracy,
    updatedAt: now,
    confidence,
    sourceCount: top.length,
    routeMatchScore: weighted.routeMatchScore,
  };
}

export function getHealthStatus(
  confidence: number,
  staleCount: number,
): BusHealthStatus {
  if (staleCount > 0 && confidence < 0.35) return "stale";
  if (confidence < 0.6) return "degraded";
  return "healthy";
}
