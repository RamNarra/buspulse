export type TrackerCandidateLike = {
  submittedAt?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  routeMatchScore: number;
  lat: number;
  lng: number;
  heading?: number | null;
  updatedAt?: number;
};

export type BusLocationLike = {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  accuracy: number;
  updatedAt: number;
  confidence: number;
  sourceCount: number;
  routeMatchScore: number;
};

const FRESH_WINDOW_MS = 30_000;
const STALE_WINDOW_MS = 90_000;

export function isCandidateStale(
  candidate: TrackerCandidateLike,
  now = Date.now(),
): boolean {
  const ts = candidate.submittedAt || candidate.updatedAt || now;
  return now - ts > STALE_WINDOW_MS;
}

export function scoreCandidate(
  candidate: TrackerCandidateLike,
  now = Date.now(),
): number {
  const ts = candidate.submittedAt || candidate.updatedAt || now;
  const ageMs = now - ts;
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
  candidates: TrackerCandidateLike[],
  now = Date.now(),
): BusLocationLike | null {
  const eligible = candidates
    .filter((candidate) => !isCandidateStale(candidate, now))
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, now),
    }))
    .sort((a, b) => b.score - a.score);

  if (!eligible.length) {
    return null;
  }

  const top = eligible.slice(0, Math.min(3, eligible.length));
  const total = top.reduce((sum, item) => sum + item.score, 0) || 1;

  const weighted = top.reduce(
    (acc, item) => {
      const weight = item.score / total;
      acc.lat += item.candidate.lat * weight;
      acc.lng += item.candidate.lng * weight;
      acc.accuracy += (item.candidate.accuracy || 10) * weight;
      acc.routeMatchScore += (item.candidate.routeMatchScore || 1) * weight;
      acc.speed += (item.candidate.speed ?? 0) * weight;
      acc.heading += (item.candidate.heading ?? 0) * weight;
      return acc;
    },
    {
      lat: 0,
      lng: 0,
      accuracy: 0,
      routeMatchScore: 0,
      speed: 0,
      heading: 0,
    },
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
): "healthy" | "degraded" | "stale" {
  if (staleCount > 0 && confidence < 0.35) {
    return "stale";
  }

  if (confidence < 0.6) {
    return "degraded";
  }

  return "healthy";
}
