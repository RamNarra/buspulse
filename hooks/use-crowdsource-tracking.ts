"use client";

import { useEffect, useRef, useState } from "react";
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  remove,
} from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { useAuthContext } from "@/components/auth/auth-provider";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { haversineMeters } from "@/lib/utils/geo";

export type TrackingState = "IDLE" | "WAITING" | "BOARDED";

/**
 * Haversine boarding threshold: student must be within 30 m of the derived bus
 * centroid AND have been at that proximity for ≥ 15 consecutive seconds before
 * transitioning to BOARDED.
 */
const BOARDED_RADIUS_M = 30;
const BOARDED_CONFIRM_MS = 15_000;

/** GPS staleness window: pings older than 30 s are excluded from centroid calc */
const STALE_PING_MS = 30_000;

/**
 * Leader Election:
 *  - Every BOARDED user writes a heartbeat to trackerCandidates/{busId}/{uid}.
 *  - A separate node trackerAssignments/{busId}/leader holds the UID of the
 *    current leader.
 *  - On each heartbeat the user attempts to claim leadership via a transaction:
 *    if the node is empty OR the previous leader has a stale timestamp, they
 *    become leader. Leaders write high-fidelity GPS; standby users skip the
 *    write to conserve battery.
 */

export function useCrowdsourceTracking() {
  const { user } = useAuthContext();
  const { student } = useCurrentStudentProfile(user);
  const [trackingState, setTrackingState] = useState<TrackingState>("IDLE");
  const [isLeader, setIsLeader] = useState(false);

  // Refs used inside the geolocation callback (avoids stale closures)
  const busLocationRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const proximityStartRef = useRef<number | null>(null);
  const trackingStateRef = useRef<TrackingState>("IDLE");

  useEffect(() => {
    if (!user || !student?.busId) return;

    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);
    const busId = student.busId;
    const uid = user.uid;

    const waitingRef = ref(db, `approachingStudents/${busId}/${uid}`);
    const boardedRef = ref(db, `trackerCandidates/${busId}/${uid}`);
    const leaderRef = ref(db, `trackerAssignments/${busId}/leader`);
    const candidatesRef = ref(db, `trackerCandidates/${busId}`);

    // Clean up this user's presence nodes when the connection drops
    onDisconnect(waitingRef).remove();
    onDisconnect(boardedRef).remove();

    // ──────────────────────────────────────────────────────────────────────
    // 1. Mirror the live bus centroid so the geolocation callback can use it
    // ──────────────────────────────────────────────────────────────────────
    const unsubCandidates = onValue(candidatesRef, (snapshot) => {
      if (!snapshot.exists()) {
        busLocationRef.current = null;
        return;
      }
      const candidates = snapshot.val() as Record<
        string,
        { lat?: number; lng?: number; updatedAt?: number }
      >;
      let tLat = 0, tLng = 0, n = 0, latest = 0;
      const now = Date.now();
      for (const id in candidates) {
        if (id === uid) continue; // exclude self from centroid used for self-assessment
        const c = candidates[id];
        if (c.lat && c.lng && c.updatedAt && now - c.updatedAt < STALE_PING_MS) {
          tLat += c.lat; tLng += c.lng; n++;
          if (c.updatedAt > latest) latest = c.updatedAt;
        }
      }
      busLocationRef.current = n > 0 ? { lat: tLat / n, lng: tLng / n, ts: latest } : null;
    });

    // ──────────────────────────────────────────────────────────────────────
    // 2. Leader election watcher — updates isLeader state
    // ──────────────────────────────────────────────────────────────────────
    const unsubLeader = onValue(leaderRef, (snapshot) => {
      const currentLeader = snapshot.val() as { uid?: string; ts?: number } | null;
      setIsLeader(currentLeader?.uid === uid);
    });

    // ──────────────────────────────────────────────────────────────────────
    // 3. Try to claim/renew leadership
    // ──────────────────────────────────────────────────────────────────────
    async function tryClaimLeadership() {
      if (trackingStateRef.current !== "BOARDED") return;
      await runTransaction(leaderRef, (current: { uid?: string; ts?: number } | null) => {
        const now = Date.now();
        // Claim if empty or previous leader went stale (>30 s without renewal)
        if (!current || !current.uid || !current.ts || now - current.ts > STALE_PING_MS) {
          return { uid, ts: now };
        }
        // Renew our own lease
        if (current.uid === uid) {
          return { uid, ts: now };
        }
        // Another active leader exists — don't overwrite
        return current;
      });
    }

    // ──────────────────────────────────────────────────────────────────────
    // 4. GPS watch — the core state machine
    // ──────────────────────────────────────────────────────────────────────
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, speed } = position.coords;
        const now = Date.now();

        // Determine state using Haversine proximity check
        const busCentroid = busLocationRef.current;
        let newState: TrackingState = "WAITING";

        if (busCentroid) {
          const distM = haversineMeters(lat, lng, busCentroid.lat, busCentroid.lng);
          if (distM <= BOARDED_RADIUS_M) {
            // Student is within 30 m of the bus centroid
            if (proximityStartRef.current === null) {
              proximityStartRef.current = now; // start timer
            }
            const elapsed = now - proximityStartRef.current;
            if (elapsed >= BOARDED_CONFIRM_MS) {
              newState = "BOARDED"; // 15 s continuous proximity → BOARDED
            } else {
              newState = "WAITING"; // still in grace period
            }
          } else {
            proximityStartRef.current = null; // reset timer on exit
            newState = "WAITING";
          }
        } else {
          // No bus centroid available yet (first person on the bus or no data).
          // Fall back to speed-based heuristic: >5 m/s (~18 km/h) → BOARDED.
          const speedMs = speed ?? 0;
          if (speedMs > 5) {
            if (proximityStartRef.current === null) proximityStartRef.current = now;
            const elapsed = now - proximityStartRef.current;
            newState = elapsed >= BOARDED_CONFIRM_MS ? "BOARDED" : "WAITING";
          } else {
            proximityStartRef.current = null;
            newState = "WAITING";
          }
        }

        trackingStateRef.current = newState;
        setTrackingState(newState);

        const payload = {
          lat,
          lng,
          speed: speed ?? 0,
          updatedAt: serverTimestamp(),
        };

        if (newState === "BOARDED") {
          void set(boardedRef, payload);
          void remove(waitingRef);
          void tryClaimLeadership();
        } else {
          void set(waitingRef, payload);
          void remove(boardedRef);
          // Yield leadership if we have it but are no longer BOARDED
          void runTransaction(leaderRef, (current: { uid?: string } | null) => {
            return current?.uid === uid ? null : current;
          });
        }
      },
      (err) => {
        console.warn("[Tracking] Geolocation error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      unsubCandidates();
      unsubLeader();
      void remove(waitingRef);
      void remove(boardedRef);
      // Yield leadership on unmount
      void runTransaction(leaderRef, (current: { uid?: string } | null) => {
        return current?.uid === uid ? null : current;
      });
    };
  }, [user, student]);

  return { trackingState, isLeader };
}
