// ── Types (mirrors types/models.ts) ──────────────────────────────────────────

export type TrackerCandidate = {
  uid: string;
  busId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy: number;
  routeMatchScore: number;
  submittedAt: number;
  source: "gps" | "network" | "passive";
};

export type BusLocation = {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy: number;
  updatedAt: number;
  confidence: number;
  sourceCount: number;
  routeMatchScore: number;
};

export type BusHealthStatus = "healthy" | "degraded" | "stale" | "offline";

export type BusHealth = {
  busId: string;
  status: BusHealthStatus;
  activeContributors: number;
  staleCandidateCount: number;
  lastDerivedAt: number;
  note: string;
};
