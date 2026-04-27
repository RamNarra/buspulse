"use server";

import { adminDb, adminAuth, adminFirestore } from "@/lib/firebase/admin";
import { type BusLocation, type BusHealth } from "@/types/models";
import { realtimePaths } from "@/lib/firebase/realtime";

export async function publishDerivedState(busId: string, location: BusLocation, health: BusHealth, idToken: string) {
  if (!adminDb || !adminAuth || !adminFirestore) {
    console.warn("Firebase Admin SDK not initialized. Server Action is skipping RTDB write.");
    return { ok: false, error: "Server admin DB not initialized" };
  }

  try {
    // 1. Verify the caller's ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // 2. Authorize the caller against Firestore profile
    const callerProfile = await adminFirestore.collection('students').doc(userId).get();
    
    if (!callerProfile.exists) {
      return { ok: false, error: "Unauthorized: Profile not found" };
    }

    if (callerProfile.data()?.busId !== busId) {
      return { ok: false, error: "Unauthorized: Not assigned to this bus" };
    }

    // Atomically write both paths
    await adminDb.ref().update({
      [realtimePaths.busLocations(busId)]: location,
      [realtimePaths.busHealth(busId)]: health,
    });
    
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to write derived state to admin DB:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}