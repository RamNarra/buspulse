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

export type BusHealthStatus =
  | "healthy"
  | "degraded"
  | "stale"
  | "offline"
  | "deviated"
  | "stranded"
  | "ghost";

export type BusHealth = {
  busId: string;
  status: BusHealthStatus;
  activeContributors: number;
  staleCandidateCount: number;
  lastDerivedAt: number;
  note: string;
};

/** Snapped-to-roads path (Phase 2.2). */
export type BusPath = {
  pts: Array<{ lat: number; lng: number }>;
  updatedAt: number;
};

/** Route document (Firestore), minimal shape needed by functions. */
export type RouteDoc = {
  id: string;
  stopIds: string[];
  polyline?: Array<{ lat: number; lng: number }>;
};
