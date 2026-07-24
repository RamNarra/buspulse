"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCandidateStale = isCandidateStale;
exports.scoreCandidate = scoreCandidate;
exports.deriveLocationFromCandidates = deriveLocationFromCandidates;
exports.getHealthStatus = getHealthStatus;
const FRESH_WINDOW_MS = 30000;
const STALE_WINDOW_MS = 90000;
function isCandidateStale(candidate, now = Date.now()) {
    const ts = candidate.submittedAt || candidate.updatedAt || now;
    return now - ts > STALE_WINDOW_MS;
}
function scoreCandidate(candidate, now = Date.now()) {
    const ts = candidate.submittedAt || candidate.updatedAt || now;
    const ageMs = now - ts;
    const freshnessScore = Math.max(0, 1 - ageMs / FRESH_WINDOW_MS);
    const accuracyScore = Math.max(0, 1 - (candidate.accuracy || 10) / 100);
    const speedScore = candidate.speed ? Math.min(candidate.speed / 14, 1) : 0.4;
    return (freshnessScore * 0.45 +
        accuracyScore * 0.3 +
        (candidate.routeMatchScore || 1) * 0.2 +
        speedScore * 0.05);
}
function deriveLocationFromCandidates(candidates, now = Date.now()) {
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
    const weighted = top.reduce((acc, item) => {
        const weight = item.score / total;
        acc.lat += item.candidate.lat * weight;
        acc.lng += item.candidate.lng * weight;
        acc.accuracy += (item.candidate.accuracy || 10) * weight;
        acc.routeMatchScore += (item.candidate.routeMatchScore || 1) * weight;
        acc.speed += (item.candidate.speed ?? 0) * weight;
        acc.heading += (item.candidate.heading ?? 0) * weight;
        return acc;
    }, {
        lat: 0,
        lng: 0,
        accuracy: 0,
        routeMatchScore: 0,
        speed: 0,
        heading: 0,
    });
    const confidence = Math.max(0, Math.min(1, top.reduce((sum, item) => sum + item.score, 0) / top.length));
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
function getHealthStatus(confidence, staleCount) {
    if (staleCount > 0 && confidence < 0.35) {
        return "stale";
    }
    if (confidence < 0.6) {
        return "degraded";
    }
    return "healthy";
}
//# sourceMappingURL=scoring.js.map