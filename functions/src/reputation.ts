/**
 * Sensor Contributor Reputation Engine.
 * Evaluates historical reliability of individual sensor streams, rewarding consistent,
 * cluster-conforming devices and penalizing teleporting or spoofed fixes.
 */

export interface ContributorReputation {
  opaqueId: string;
  score: number; // 0.0 to 1.0
  totalContributions: number;
  validContributions: number;
  lastUpdated: number;
}

const DEFAULT_INITIAL_SCORE = 0.5;

export function evaluateContributorReputation(
  current: ContributorReputation | undefined,
  isValidFix: boolean,
  isClusterMember: boolean,
  now = Date.now(),
): ContributorReputation {
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
  } else {
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

export interface CandidateWithId {
  id?: string;
  lat: number;
  lng: number;
  [key: string]: unknown;
}

/**
 * Filters out candidates submitted by sensors with reputation scores below minimum threshold.
 */
export function filterReputableCandidates<T extends CandidateWithId>(
  candidates: T[],
  reputations: Record<string, ContributorReputation>,
  minReputationThreshold = 0.35,
): T[] {
  return candidates.filter((c) => {
    if (!c.id) return true;
    const rep = reputations[c.id];
    if (!rep) return true; // Default allow new sensors
    return rep.score >= minReputationThreshold;
  });
}
