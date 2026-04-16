import {
  busHealthSchema,
  presenceSchema,
  trackerCandidateSchema,
  type BusHealth,
  type Presence,
  type TrackerCandidate,
} from "@/types/models";
import { deriveLocationFromCandidates, getHealthStatus, isCandidateStale } from "@/lib/live/scoring";
import { writeDerivedState, writePresence, writeTrackerCandidate } from "@/lib/firebase/realtime";

export type ContributionInput = {
  uid: string;
  busId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy: number;
  routeMatchScore?: number;
};

export type PresenceInput = {
  uid: string;
  busId: string;
  activeRouteId: string;
  deviceId: string;
  appState: "foreground" | "background" | "inactive";
  batteryLevel?: number;
};

export async function submitLocationContribution(
  input: ContributionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const candidate: TrackerCandidate = {
    uid: input.uid,
    busId: input.busId,
    lat: input.lat,
    lng: input.lng,
    heading: input.heading,
    speed: input.speed,
    accuracy: input.accuracy,
    routeMatchScore: input.routeMatchScore ?? 0.5,
    submittedAt: Date.now(),
    source: "gps",
  };

  const parsed = trackerCandidateSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid candidate payload: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    };
  }

  return writeTrackerCandidate(parsed.data);
}

export async function heartbeatPresence(
  input: PresenceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const presence: Presence = {
    ...input,
    lastHeartbeatAt: Date.now(),
  };

  const parsed = presenceSchema.safeParse(presence);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid presence payload: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    };
  }

  return writePresence(parsed.data);
}

export function deriveBusHealth(
  busId: string,
  candidates: TrackerCandidate[],
  now = Date.now(),
): { locationAvailable: boolean; health: BusHealth } {
  const staleCandidateCount = candidates.filter((candidate) =>
    isCandidateStale(candidate, now),
  ).length;
  const derived = deriveLocationFromCandidates(candidates, now);
  const confidence = derived?.confidence ?? 0;

  const health = busHealthSchema.parse({
    busId,
    status: derived ? getHealthStatus(confidence, staleCandidateCount) : "offline",
    activeContributors: candidates.length - staleCandidateCount,
    staleCandidateCount,
    lastDerivedAt: now,
    note: derived
      ? `Derived from ${derived.sourceCount} active candidate signals.`
      : "No active candidate signals available.",
  });

  return { locationAvailable: Boolean(derived), health };
}

export async function deriveAndPublishBusState(
  busId: string,
  candidates: TrackerCandidate[],
): Promise<{ ok: true; health: BusHealth } | { ok: false; error: string }> {
  const now = Date.now();
  const location = deriveLocationFromCandidates(candidates, now);
  const { health } = deriveBusHealth(busId, candidates, now);

  if (!location) {
    return {
      ok: false,
      error:
        "No recent tracker candidates found. Keep heartbeats active for contributors on this route.",
    };
  }

  const writeResult = await writeDerivedState(busId, location, health);
  if (!writeResult.ok) {
    return writeResult;
  }

  return { ok: true, health };
}
