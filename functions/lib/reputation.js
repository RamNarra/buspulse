"use strict";
/**
 * Sensor Contributor Reputation Engine.
 * Evaluates historical reliability of individual sensor streams, rewarding consistent,
 * cluster-conforming devices and penalizing teleporting or spoofed fixes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateContributorReputation = evaluateContributorReputation;
exports.filterReputableCandidates = filterReputableCandidates;
const DEFAULT_INITIAL_SCORE = 0.5;
function evaluateContributorReputation(current, isValidFix, isClusterMember, now = Date.now()) {
    const existing = current ?? {
        opaqueId: '',
        score: DEFAULT_INITIAL_SCORE,
        totalContributions: 0,
        validContributions: 0,
        lastUpdated: now,
    };
    const newTotal = existing.totalContributions + 1;
    let newValid = existing.validContributions;
    let newScore = existing.score;
    if (isValidFix && isClusterMember) {
        newValid += 1;
        newScore = Math.min(0.98, existing.score + 0.05);
    }
    else {
        newScore = Math.max(0.1, existing.score - 0.25);
    }
    return {
        opaqueId: existing.opaqueId,
        score: Number(newScore.toFixed(2)),
        totalContributions: newTotal,
        validContributions: newValid,
        lastUpdated: now,
    };
}
/**
 * Filters out candidates submitted by sensors with reputation scores below minimum threshold.
 */
function filterReputableCandidates(candidates, reputations, minReputationThreshold = 0.35) {
    return candidates.filter((c) => {
        if (!c.id)
            return true;
        const rep = reputations[c.id];
        if (!rep)
            return true; // Default allow new sensors
        return rep.score >= minReputationThreshold;
    });
}
//# sourceMappingURL=reputation.js.map