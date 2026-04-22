import {
  child,
  get,
  getDatabase,
  onValue,
  ref,
  set,
  update,
  type Database,
} from "firebase/database";

import {
  busHealthSchema,
  busLocationSchema,
  presenceSchema,
  trackerCandidateSchema,
  type BusHealth,
  type BusLocation,
  type Presence,
  type TrackerCandidate,
} from "@/types/models";
import { getFirebaseClientApp } from "@/lib/firebase/client";

type PresenceHeartbeatInput = Omit<Presence, "lastHeartbeatAt"> & {
  lastHeartbeatAt?: number;
};

type CandidateInput = Omit<TrackerCandidate, "submittedAt" | "source"> & {
  submittedAt?: number;
  source?: TrackerCandidate["source"];
};

type DerivedBusSnapshot = {
  location: BusLocation | null;
  health: BusHealth | null;
  stale: boolean;
  confidence: number | null;
  lastUpdatedAt: number | null;
};

export const realtimePaths = {
  presence: (uid: string) => `presence/${uid}`,
  trackerCandidates: (busId: string, uid: string) => `trackerCandidates/${busId}/${uid}`,
  trackerAssignments: (busId: string) => `trackerAssignments/${busId}`,
  busLocations: (busId: string) => `busLocations/${busId}`,
  busHealth: (busId: string) => `busHealth/${busId}`,
};

export function isLiveDataStale(
  updatedAt: number | null | undefined,
  thresholdMs = 90_000,
): boolean {
  if (!updatedAt) {
    return true;
  }

  return Date.now() - updatedAt > thresholdMs;
}

export function getRealtimeDb(): Database | null {
  const app = getFirebaseClientApp();
  if (!app) {
    return null;
  }

  return getDatabase(app);
}

export async function writePresenceHeartbeat(
  input: PresenceHeartbeatInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getRealtimeDb();
  if (!db) {
    return { ok: false, error: "Realtime Database is not configured." };
  }

  const payload = presenceSchema.safeParse({
    ...input,
    lastHeartbeatAt: input.lastHeartbeatAt ?? Date.now(),
  });
  if (!payload.success) {
    return {
      ok: false,
      error: `Invalid presence payload: ${payload.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    };
  }

  try {
    await set(ref(db, realtimePaths.presence(payload.data.uid)), payload.data);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to write presence.",
    };
  }
}

export async function writeLocationContribution(
  input: CandidateInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getRealtimeDb();
  if (!db) {
    return { ok: false, error: "Realtime Database is not configured." };
  }

  const payload = trackerCandidateSchema.safeParse({
    ...input,
    submittedAt: input.submittedAt ?? Date.now(),
    source: input.source ?? "gps",
  });
  if (!payload.success) {
    return {
      ok: false,
      error: `Invalid location contribution: ${payload.error.issues
        .map((issue) => issue.message)
        .join(", ")}`,
    };
  }

  try {
    await set(
      ref(
        db,
        realtimePaths.trackerCandidates(payload.data.busId, payload.data.uid),
      ),
      payload.data,
    );
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to write location contribution.",
    };
  }
}

export async function writePresence(presence: Presence): Promise<{ ok: true } | { ok: false; error: string }> {
  return writePresenceHeartbeat(presence);
}

export async function writeTrackerCandidate(
  candidate: TrackerCandidate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return writeLocationContribution(candidate);
}

export async function writeDerivedState(
  busId: string,
  location: BusLocation,
  health: BusHealth,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getRealtimeDb();
  if (!db) {
    return { ok: false, error: "Realtime Database is not configured." };
  }

  try {
    await update(ref(db), {
      [realtimePaths.busLocations(busId)]: location,
      [realtimePaths.busHealth(busId)]: health,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to write derived state.",
    };
  }
}

export async function readBusLocation(
  busId: string,
): Promise<{ ok: true; location: BusLocation | null } | { ok: false; error: string }> {
  const db = getRealtimeDb();
  if (!db) {
    return { ok: false, error: "Realtime Database is not configured." };
  }

  try {
    const snapshot = await get(child(ref(db), realtimePaths.busLocations(busId)));
    if (!snapshot.exists()) {
      return { ok: true, location: null };
    }

    const parsed = busLocationSchema.safeParse(snapshot.val());
    if (!parsed.success) {
      return { ok: false, error: "Realtime bus location payload shape is invalid." };
    }

    return { ok: true, location: parsed.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read bus location.",
    };
  }
}

export async function readBusHealth(
  busId: string,
): Promise<{ ok: true; health: BusHealth | null } | { ok: false; error: string }> {
  const db = getRealtimeDb();
  if (!db) {
    return { ok: false, error: "Realtime Database is not configured." };
  }

  try {
    const snapshot = await get(child(ref(db), realtimePaths.busHealth(busId)));
    if (!snapshot.exists()) {
      return { ok: true, health: null };
    }

    const parsed = busHealthSchema.safeParse(snapshot.val());
    if (!parsed.success) {
      return { ok: false, error: "Realtime bus health payload shape is invalid." };
    }

    return { ok: true, health: parsed.data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to read bus health.",
    };
  }
}

export function subscribeToBusLocation(
  busId: string,
  onLocation: (location: BusLocation | null) => void,
): (() => void) | null {
  const db = getRealtimeDb();
  if (!db) {
    return null;
  }

  return onValue(ref(db, realtimePaths.busLocations(busId)), (snapshot) => {
    if (!snapshot.exists()) {
      onLocation(null);
      return;
    }

    const parsed = busLocationSchema.safeParse(snapshot.val());
    onLocation(parsed.success ? parsed.data : null);
  });
}

export function subscribeToDerivedBusState(
  busId: string,
  onState: (snapshot: DerivedBusSnapshot) => void,
  staleThresholdMs = 90_000,
): (() => void) | null {
  const db = getRealtimeDb();
  if (!db) {
    return null;
  }

  let location: BusLocation | null = null;
  let health: BusHealth | null = null;

  const emit = () => {
    onState({
      location,
      health,
      stale: isLiveDataStale(location?.updatedAt ?? null, staleThresholdMs),
      confidence: location?.confidence ?? null,
      lastUpdatedAt: location?.updatedAt ?? null,
    });
  };

  const unsubscribeLocation = onValue(
    ref(db, realtimePaths.busLocations(busId)),
    (snapshot) => {
      // Only use fallback location if we aren't already deriving from candidates
      if (!snapshot.exists()) {
        if (!location || location.confidence === 0) location = null;
      } else {
        const parsed = busLocationSchema.safeParse(snapshot.val());
        if (parsed.success && (!location || location.confidence === 0)) {
          location = parsed.data;
        }
      }
      emit();
    },
  );

  const unsubscribeCandidates = onValue(
    ref(db, `trackerCandidates/${busId}`),
    (snapshot) => {
      if (snapshot.exists()) {
        const candidates = snapshot.val();
        let totalLat = 0;
        let totalLng = 0;
        let count = 0;
        let latestUpdate = 0;

        for (const uid in candidates) {
          const candidate = candidates[uid];
          // Filter out stale candidates (> 30 seconds old)
          if (
            candidate.lat && 
            candidate.lng && 
            candidate.updatedAt && 
            (Date.now() - candidate.updatedAt < 30000)
          ) {
            totalLat += candidate.lat;
            totalLng += candidate.lng;
            count++;
            if (candidate.updatedAt > latestUpdate) latestUpdate = candidate.updatedAt;
          }
        }

        if (count > 0) {
          location = {
            lat: totalLat / count,
            lng: totalLng / count,
            accuracy: 10,
            sourceCount: count,
            routeMatchScore: 1,
            speed: undefined,
            heading: undefined,
            confidence: count, // Confidence represents the number of active trackers!
            updatedAt: latestUpdate,
          };
        } else {
          location = { ...location, confidence: 0 } as BusLocation; // Mark as fallback mode
        }
      } else {
        location = { ...location, confidence: 0 } as BusLocation;
      }
      
      emit();
    }
  );

  const unsubscribeHealth = onValue(ref(db, realtimePaths.busHealth(busId)), (snapshot) => {
    if (!snapshot.exists()) {
      health = null;
    } else {
      const parsed = busHealthSchema.safeParse(snapshot.val());
      health = parsed.success ? parsed.data : null;
    }

    emit();
  });

  return () => {
    unsubscribeLocation();
    unsubscribeCandidates();
    unsubscribeHealth();
  };
}
