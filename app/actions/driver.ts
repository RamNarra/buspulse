"use server";

import { adminDb } from "@/lib/firebase/admin";
import { type BusLocation, type TrackerCandidate } from "@/types/models";
import { realtimePaths } from "@/lib/firebase/realtime";

export async function publishDriverLocation(busId: string, candidate: TrackerCandidate) {
  if (!adminDb) {
    console.warn("adminDb not initialized. Server Action is skipping RTDB write.");
    return { ok: false, error: "Server admin DB not initialized" };
  }

  // In a truly strict environment, we'd verify the caller here via cookies or passing an ID token.
  // For now, we trust the incoming candidate from the /driver page as the Trusted Source.
  
  // Transform candidate into a canonical BusLocation
  const location: BusLocation = {
    lat: candidate.lat,
    lng: candidate.lng,
    heading: candidate.heading,
    speed: candidate.speed,
    accuracy: candidate.accuracy,
    updatedAt: candidate.submittedAt,
    confidence: 1.0, // Trusted driver source
    sourceCount: 1,
    routeMatchScore: candidate.routeMatchScore,
  };

  try {
    await adminDb.ref(realtimePaths.busLocations(busId)).set(location);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to write to admin DB:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
