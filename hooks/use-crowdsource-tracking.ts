"use client";

import { useEffect, useRef, useState } from "react";
import {
  getDatabase,
  onDisconnect,
  onValue,
  ref,
  runTransaction,
  set,
  remove,
  update,
} from "firebase/database";
import { getFirebaseClientApp } from "@/lib/firebase/client";
import { useAuthContext } from "@/components/auth/auth-provider";
import { useCurrentStudentProfile } from "@/hooks/use-current-student-profile";
import { haversineMeters } from "@/lib/utils/geo";

declare global {
  interface Window {
    __buspulse_injectPos?: (pos: GeolocationPosition) => void;
  }
}

export type TrackingState = "IDLE" | "WAITING" | "BOARDED";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Radius within which a student is considered co-located with the bus. */
const BOARDED_RADIUS_M = 30;

/** How long (ms) proximity must be maintained before confirming BOARDED. */
const BOARDED_CONFIRM_MS = 8_000;

/**
 * Speed (m/s) at which a user with NO peer bus centroid available can self-
 * promote to BOARDED. 1.5 m/s ≈ 5.4 km/h — slow walking/crawling traffic.
 */
const COLD_START_SPEED_MS = 1.5;

/**
 * Once BOARDED, stay BOARDED for at least this long even if the user slows
 * down or temporarily loses the bus centroid (traffic jam hysteresis).
 */
const BOARDED_STICKY_MS = 120_000; // 2 minutes

/**
 * If the user is BOARDED and comes to a complete stop near a known bus stop,
 * demote them faster (they probably got off). Requires the stops list.
 */
const STOP_DEMOTION_MS = 30_000; // 30 seconds near a stop

/** GPS staleness window: pings older than 30s are excluded from centroid. */
const STALE_PING_MS = 30_000;

/** Radius used to check if the user is near a static bus stop. */
const NEAR_STOP_RADIUS_M = 40;

/** Minimum number of co-located, co-moving peers required for "Mutual Discovery". */
const MUTUAL_DISCOVERY_PEERS = 2;

/**
 * Speed (m/s) each peer must exceed for Mutual Discovery to trigger.
 * 0.3 m/s ≈ 1 km/h — safe floor; browser GPS speed reports are imprecise.
 */
const MUTUAL_DISCOVERY_SPEED_MS = 0.3;

/**
 * Peer-to-peer proximity radius for Mutual Discovery.
 * Wider than BOARDED_RADIUS_M because raw browser GPS has ±10–30 m error each,
 * so two students in the same bus may appear 40–80 m apart.
 */
const MUTUAL_DISCOVERY_RADIUS_M = 80;

// ── Types ─────────────────────────────────────────────────────────────────────

type PeerPing = {
  lat: number;
  lng: number;
  speed: number;
  updatedAt: number;
  visible?: boolean;
};

type BusStop = { lat: number; lng: number };

// ── Hook ──────────────────────────────────────────────────────────────────────

const EMPTY_STOPS: BusStop[] = [];

export function useCrowdsourceTracking(busStops: BusStop[] = EMPTY_STOPS) {
  const [manualOverride, _setManualOverride] = useState<boolean | null>(null);
  const manualOverrideRef = useRef<boolean | null>(null);
  const setManualOverride = (val: boolean | null) => {
    manualOverrideRef.current = val;
    _setManualOverride(val);
    
    if (val === true) {
      setTrackingState("BOARDED");
      trackingStateRef.current = "BOARDED";
    } else if (val === false) {
      setTrackingState("WAITING");
      trackingStateRef.current = "WAITING";
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (typeof window !== 'undefined' && window.__buspulse_injectPos) {
            window.__buspulse_injectPos(pos);
          }
        },
        (err) => console.warn("Manual poll error:", err),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  };

  const { user } = useAuthContext();
  const { student } = useCurrentStudentProfile(user);

  const [trackingState, setTrackingState] = useState<TrackingState>("IDLE");
  const [isLeader, setIsLeader] = useState(false);
  const [peerCount, setPeerCount] = useState(0);

  // ── Refs (stable across renders, safe inside callbacks) ────────────────────
  const busLocationRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const peersRef = useRef<Record<string, PeerPing>>({});
  const proximityStartRef = useRef<number | null>(null);
  const lastBoardedAtRef = useRef<number | null>(null);
  const nearStopSinceRef = useRef<number | null>(null);
  const trackingStateRef = useRef<TrackingState>("IDLE");
  const isLeaderRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastLeadershipRenewRef = useRef<number>(0);
  const currentLeaderRef = useRef<{ uid?: string; ts?: number } | null>(null);

  /**
   * Last raw GPS fix — used to derive speed from position deltas when
   * GeolocationCoordinates.speed returns null (common on Android Chrome & desktop).
   */
  const lastGpsRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);

  // Upload coalescing (Phase 1.4): suppress writes that are < 2 s apart and
  // don't represent a meaningful position change (< 5 m AND < 5° heading change).
  const lastUploadRef = useRef<{
    ts: number;
    lat: number;
    lng: number;
    heading: number;
  } | null>(null);

  // Ephemeral UUID for pseudo-anonymous tracking
  const opaqueIdRef = useRef<string | null>(null);

  // ── Wake Lock helpers ──────────────────────────────────────────────────────
  async function acquireWakeLock() {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Permission denied or unsupported — silent
    }
  }

  async function releaseWakeLock() {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch { /* silent */ }
      wakeLockRef.current = null;
    }
  }

  useEffect(() => {
    if (!user || !student?.busId) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    const app = getFirebaseClientApp();
    if (!app) return;
    const db = getDatabase(app);
    const busId = student.busId;
    const uid = user.uid;

    if (!opaqueIdRef.current) {
      opaqueIdRef.current = crypto.randomUUID();
    }
    const opaqueId = opaqueIdRef.current;

    // Firebase node refs — defined early so cleanup can reference them even if
    // the async setup hasn't completed yet.
    const mappingRef = ref(db, `trackerMappings/${opaqueId}`);
    const waitingRef = ref(db, `approachingStudents/${busId}/${opaqueId}`);
    const boardedRef = ref(db, `trackerCandidates/${busId}/${opaqueId}`);
    const leaderRef = ref(db, `trackerAssignments/${busId}/leader`);
    const candidatesRef = ref(db, `trackerCandidates/${busId}`);
    const othersWaitingRef = ref(db, `approachingStudents/${busId}`);

    // Clean up on disconnect regardless of whether setup completes
    onDisconnect(mappingRef).remove();
    onDisconnect(waitingRef).remove();
    onDisconnect(boardedRef).remove();

    // Cleanup handles for subscriptions and GPS watcher — populated after setup.
    let unsubCandidates: (() => void) | null = null;
    let unsubOthersWaiting: (() => void) | null = null;
    let unsubLeader: (() => void) | null = null;
    let watchId: number | null = null;
    let onVisibilityChangeHandler: (() => void) | null = null;
    let isCancelled = false; // set to true if the effect cleanup runs before setup finishes

    // ── ASYNC SETUP ──────────────────────────────────────────────────────────
    // We MUST await the trackerMappings write before starting GPS or any
    // subscriptions. The RTDB write rules for trackerCandidates and
    // approachingStudents verify that trackerMappings/{opaqueId}.uid matches
    // auth.uid. If GPS fires before the mapping is committed, every write
    // is silently rejected and peers never see each other.
    void (async () => {
      // Register opaque ID mapping — AWAIT so it's committed before GPS starts.
      await set(mappingRef, { uid, busId });

      if (isCancelled) return; // effect was cleaned up while we awaited
      // Subscriptions, GPS, and visibility listener are now safe to start
      // because the mapping is guaranteed to exist in RTDB.

    // ── 1. Mirror peer pings (Both Boarded and Waiting) ─────────────────────
    const syncPeers = (
      boarded: Record<string, Partial<PeerPing>>, 
      waiting: Record<string, Partial<PeerPing>>
    ) => {
      const now = Date.now();
      const combined: Record<string, PeerPing> = {};
      let tLat = 0, tLng = 0, nBoarded = 0, latest = 0;

      const processNode = (nodes: Record<string, Partial<PeerPing>>, isBoarded: boolean) => {
        for (const id in nodes) {
          if (id === opaqueId) continue;
          const c = nodes[id];
          if (
            typeof c.lat === "number" && typeof c.lng === "number" &&
            typeof c.updatedAt === "number" && now - c.updatedAt < STALE_PING_MS
          ) {
            const ping: PeerPing = {
              lat: c.lat, lng: c.lng,
              speed: c.speed ?? 0,
              updatedAt: c.updatedAt,
              visible: c.visible ?? true,
            };
            combined[id] = ping;
            if (isBoarded) {
              tLat += c.lat; tLng += c.lng; nBoarded++;
              if (c.updatedAt > latest) latest = c.updatedAt;
            }
          }
        }
      };

      processNode(boarded, true);
      processNode(waiting, false);

      peersRef.current = combined;
      setPeerCount(Object.keys(combined).length);
      busLocationRef.current = nBoarded > 0
        ? { lat: tLat / nBoarded, lng: tLng / nBoarded, ts: latest }
        : null;
    };

    let lastBoarded: Record<string, Partial<PeerPing>> = {};
    let lastWaiting: Record<string, Partial<PeerPing>> = {};

    unsubCandidates = onValue(candidatesRef, (snapshot) => {
      lastBoarded = snapshot.exists() ? snapshot.val() : {};
      syncPeers(lastBoarded, lastWaiting);
    });

    unsubOthersWaiting = onValue(othersWaitingRef, (snapshot) => {
      lastWaiting = snapshot.exists() ? snapshot.val() : {};
      syncPeers(lastBoarded, lastWaiting);
    });

    // ── 2. Leader watcher ──────────────────────────────────────────────
    unsubLeader = onValue(leaderRef, (snapshot) => {
      const current = snapshot.val() as { uid?: string; ts?: number } | null;
      currentLeaderRef.current = current;
      const amLeader = current?.uid === opaqueId;
      isLeaderRef.current = amLeader;
      setIsLeader(amLeader);

      if (amLeader && trackingStateRef.current === "BOARDED") {
        void acquireWakeLock();
      } else {
        void releaseWakeLock();
      }
    });

    // ── 3. Leadership claim / renewal ───────────────────────────────────────
    async function tryClaimLeadership(visible: boolean) {
      if (trackingStateRef.current !== "BOARDED") return;
      if (!visible) return; // Don't claim if hidden — let a visible peer take over

      const now = Date.now();
      const current = currentLeaderRef.current;
      const isAlreadyLeader = current?.uid === opaqueId;
      const isStale = !current?.uid || !current?.ts || (now - current.ts > STALE_PING_MS);

      // Only attempt a transaction if we genuinely believe we need to claim or renew
      // Renew every 10 seconds if we are the leader
      if (isAlreadyLeader && (now - lastLeadershipRenewRef.current < 10_000)) {
        return;
      }
      
      // If we are NOT the leader, only try to claim if the current one appears stale
      if (!isAlreadyLeader && !isStale) {
        return;
      }

      // Mark the attempt time so we don't spam transactions
      lastLeadershipRenewRef.current = now;

      await runTransaction(leaderRef, (currentTx: { uid?: string; ts?: number } | null) => {
        const txNow = Date.now();
        if (!currentTx?.uid || !currentTx?.ts || txNow - currentTx.ts > STALE_PING_MS) {
          return { uid: opaqueId, ts: txNow }; // Claim — seat is empty or stale
        }
        if (currentTx.uid === opaqueId) {
          return { uid: opaqueId, ts: txNow }; // Renew own lease
        }
        return currentTx; // Another active leader — stand by
      });
    }

    async function yieldLeadership() {
      await runTransaction(leaderRef, (current: { uid?: string } | null) => {
        return current?.uid === opaqueId ? null : current;
      });
    }

    // ── 4. Visibility-based leader handoff ──────────────────────────────────
    onVisibilityChangeHandler = function onVisibilityChange() {
      const hidden = document.hidden;
      if (hidden && isLeaderRef.current) {
        void yieldLeadership();
        void releaseWakeLock();
      }
      // Update our own ping to advertise visibility status
      if (trackingStateRef.current === "BOARDED") {
        void update(boardedRef, { visible: !hidden });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChangeHandler);

    // ── 5. GPS State Machine — commitState declared first because handlePos calls it ───
    // ── 5a. Commit state to Firebase ────────────────────────────────────────
    function commitState(
      newState: TrackingState,
      lat: number,
      lng: number,
      speedMs: number,
      visible: boolean,
    ) {
      const stateChanged = newState !== trackingStateRef.current;
      if (stateChanged) {
        trackingStateRef.current = newState;
        setTrackingState(newState);
      }

      // ── Upload coalescing: skip write if state unchanged, < 2 s, and < 5 m.
      const now = Date.now();
      const prev = lastUploadRef.current;
      if (!stateChanged && prev) {
        const elapsedMs = now - prev.ts;
        const distM = haversineMeters(prev.lat, prev.lng, lat, lng);
        const newHeading =
          distM > 0
            ? (Math.atan2(lng - prev.lng, lat - prev.lat) * 180) / Math.PI
            : prev.heading;
        const headingDelta = Math.abs(((newHeading - prev.heading + 540) % 360) - 180);
        if (elapsedMs < 2_000) return;
        if (distM < 5 && headingDelta < 5) return;
      }
      const newHeadingForRef =
        prev && haversineMeters(prev.lat, prev.lng, lat, lng) > 0
          ? (Math.atan2(lng - prev.lng, lat - prev.lat) * 180) / Math.PI
          : prev?.heading ?? 0;
      lastUploadRef.current = { ts: now, lat, lng, heading: newHeadingForRef };

      if (newState === "BOARDED") {
        if (!lastBoardedAtRef.current) lastBoardedAtRef.current = Date.now();
        void set(boardedRef, { lat, lng, speed: speedMs, visible, updatedAt: Date.now() });
        void remove(waitingRef);
        void tryClaimLeadership(visible);
      } else {
        lastBoardedAtRef.current = null;
        void set(waitingRef, { lat, lng, speed: speedMs, updatedAt: Date.now() });
        void remove(boardedRef);
        void yieldLeadership();
      }
    }

    // ── 5b. GPS position handler ─────────────────────────────────────────────
    const handlePos = (position: GeolocationPosition) => {

        const { latitude: lat, longitude: lng, speed } = position.coords;
        const now = Date.now();
        const visible = !document.hidden;

        // ── Derive speed from position deltas when browser returns null ───────
        // GeolocationCoordinates.speed is null on most Android Chrome and desktop
        // browsers. Without this fallback ALL speed checks fail → stuck in WAITING.
        let derivedSpeedMs = 0;
        const prev = lastGpsRef.current;
        if (prev) {
          const dtSec = (now - prev.ts) / 1000;
          if (dtSec > 0 && dtSec < 30) { // ignore stale gaps > 30 s
            derivedSpeedMs = haversineMeters(prev.lat, prev.lng, lat, lng) / dtSec;
          }
        }
        lastGpsRef.current = { lat, lng, ts: now };

        // Use the best available speed: GPS-reported if valid, otherwise derived.
        // Cap derived speed at 40 m/s (144 km/h) to suppress GPS jumps.
        const speedMs = Math.min(
          Math.max(speed ?? 0, derivedSpeedMs),
          40,
        );

        // ── Determine if we are near a known bus stop ─────────────────────
        const nearStop = busStops.some(
          (s) => haversineMeters(lat, lng, s.lat, s.lng) <= NEAR_STOP_RADIUS_M,
        );

        // ── Track near-stop time ──────────────────────────────────────────
        if (nearStop && speedMs < 0.5) {
          if (nearStopSinceRef.current === null) nearStopSinceRef.current = now;
        } else {
          nearStopSinceRef.current = null;
        }

        // ── Sticky hysteresis: once BOARDED, resist demotion ─────────────
        const currentState = trackingStateRef.current;
        const lastBoarded = lastBoardedAtRef.current;
        const boardedFor = lastBoarded ? now - lastBoarded : 0;

        if (currentState === "BOARDED" && lastBoarded) {
          // Near a stop + stationary for 30s → likely alighted
          const nearStopFor = nearStopSinceRef.current
            ? now - nearStopSinceRef.current
            : 0;
          if (nearStop && speedMs < 0.5 && nearStopFor >= STOP_DEMOTION_MS) {
            // Fast-track demotion
          } else if (boardedFor < BOARDED_STICKY_MS) {
            // Within 2-min sticky window — keep BOARDED regardless of speed
            commitState("BOARDED", lat, lng, speedMs, visible);
            return;
          }
        }

        // ── Determine new state ───────────────────────────────────────────
        const busCentroid = busLocationRef.current;
        if (manualOverrideRef.current !== null) {
          commitState(manualOverrideRef.current ? "BOARDED" : "WAITING", lat, lng, speedMs, visible);
          return;
        }
        let newState: TrackingState = "WAITING";

        if (busCentroid) {
          const distM = haversineMeters(lat, lng, busCentroid.lat, busCentroid.lng);
          if (distM <= BOARDED_RADIUS_M) {
            if (proximityStartRef.current === null) proximityStartRef.current = now;
            const elapsed = now - proximityStartRef.current;
            newState = elapsed >= BOARDED_CONFIRM_MS ? "BOARDED" : "WAITING";
          } else {
            proximityStartRef.current = null;
            newState = "WAITING";
          }
        } else {
          // ── Cold start: Mutual Discovery OR speed heuristic ───────────
          const movingPeersNearby = Object.values(peersRef.current).filter(
            (p) =>
              haversineMeters(lat, lng, p.lat, p.lng) <= MUTUAL_DISCOVERY_RADIUS_M &&
              p.speed >= MUTUAL_DISCOVERY_SPEED_MS,
          );

          if (
            movingPeersNearby.length >= MUTUAL_DISCOVERY_PEERS - 1 && // -1 because we count self
            speedMs >= MUTUAL_DISCOVERY_SPEED_MS
          ) {
            // Mutual discovery: we + 1 moving peer = bus formation
            if (proximityStartRef.current === null) proximityStartRef.current = now;
            const elapsed = now - proximityStartRef.current;
            newState = elapsed >= BOARDED_CONFIRM_MS ? "BOARDED" : "WAITING";
          } else if (speedMs >= COLD_START_SPEED_MS) {
            // Solo speed heuristic
            if (proximityStartRef.current === null) proximityStartRef.current = now;
            const elapsed = now - proximityStartRef.current;
            newState = elapsed >= BOARDED_CONFIRM_MS ? "BOARDED" : "WAITING";
          } else {
            proximityStartRef.current = null;
            newState = "WAITING";
          }
        }

        commitState(newState, lat, lng, speedMs, visible);
      
    };
    window.__buspulse_injectPos = handlePos;

      watchId = navigator.geolocation.watchPosition(
        handlePos,
        (err) => console.warn("[Tracking] GPS error:", err.message),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 }
      );
    })(); // end async IIFE

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      isCancelled = true; // stop async IIFE from starting GPS after this point
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      window.__buspulse_injectPos = undefined;
      if (onVisibilityChangeHandler) {
        document.removeEventListener("visibilitychange", onVisibilityChangeHandler);
      }
      unsubCandidates?.();
      unsubOthersWaiting?.();
      unsubLeader?.();
      void remove(waitingRef);
      void remove(boardedRef);
      void remove(mappingRef);
    };
  }, [user, student, busStops]);

  return { trackingState, isLeader, peerCount, manualOverride, setManualOverride };
}
