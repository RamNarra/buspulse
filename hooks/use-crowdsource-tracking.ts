"use client";

import { useEffect, useState } from "react";
import { ref, set, serverTimestamp, onDisconnect, getDatabase } from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { useAuthContext } from "@/components/auth/auth-provider";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";

type TrackingState = "IDLE" | "WAITING" | "BOARDED";

export function useCrowdsourceTracking() {
  const { user } = useAuthContext();
  const { student } = useCurrentStudentProfile(user);
  const [trackingState, setTrackingState] = useState<TrackingState>("IDLE");
  
  useEffect(() => {
    if (!user || !student || !student.busId) return;
    
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);

    // References
    const waitingRef = ref(db, `approachingStudents/${student.busId}/${user.uid}`);
    const boardedRef = ref(db, `trackerCandidates/${student.busId}/${user.uid}`);

    // Clean up on disconnect
    onDisconnect(waitingRef).remove();
    onDisconnect(boardedRef).remove();

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        
        // Simple logic for MVP: 
        // If speed is > 3 m/s (approx 10 km/h), they are likely in a moving vehicle (BOARDED).
        // Otherwise, they are WAITING. 
        // In a full production version, we would cross-reference the bus's previous location to confirm the merge.
        // For the MVP demo, we assume any active GPS ping counts as BOARDED to ensure the bus spawns immediately.
        // In production, we'd use: const isMovingFast = speed && speed > 3;
        const isMovingFast = true;
        const newState: TrackingState = isMovingFast ? "BOARDED" : "WAITING";
        
        setTrackingState(newState);

        const payload = {
          lat: latitude,
          lng: longitude,
          speed: speed || 0,
          updatedAt: serverTimestamp(),
        };

        if (newState === "BOARDED") {
          set(boardedRef, payload);
          set(waitingRef, null); // Remove from waiting
        } else {
          set(waitingRef, payload);
          set(boardedRef, null); // Remove from boarded
        }
      },
      (error) => {
        console.warn("[Crowdsource] Geolocation error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      set(waitingRef, null).catch(() => {});
      set(boardedRef, null).catch(() => {});
    };
  }, [user, student]);

  return { trackingState };
}
