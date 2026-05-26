// ── FCM proximity notifier (Phase 5) ─────────────────────────────────────────
// Fires on every write to busLocations/{busId}.
// Queries Firestore for stops on the bus's route and students assigned to those
// stops. When the bus is within NOTIFY_RADIUS_M of a stop that hasn't been
// notified recently, sends "Your bus is 2 stops away" via FCM.
//
// Prerequisites:
//  1. Students must have an fcmToken field (saved by hooks/use-fcm-token.ts).
//  2. FCM Admin SDK is initialised via admin.initializeApp() in index.ts.
//  3. Set NOTIFY_SECRET env var if you also want to call /api/notify.

import * as admin from "firebase-admin";
import { onValueWritten } from "firebase-functions/v2/database";
import { haversineMeters } from "./geo";
import type { BusLocation } from "./models";
import { FUNCTION_REGION } from "./region";

/** Radius (m) within which the bus is "at" a stop and we notify waiting students. */
const NOTIFY_RADIUS_M = 400;

/**
 * How many stops ahead to use as the trigger point.
 * "2 stops away" means the bus is within NOTIFY_RADIUS_M of stop[index - 2].
 */
const STOPS_AHEAD = 2;

/**
 * Don't re-notify for the same (busId, stopId) pair within this window.
 * Prevents spamming when the bus lingers near a stop.
 */
const DEDUP_WINDOW_MS = 5 * 60_000; // 5 minutes

// ── In-memory caches for static route and stops configuration ────────────────
interface CachedStop {
  id: string;
  lat: number;
  lng: number;
  order: number;
  name: string;
}

const busRouteCache: Record<string, { routeId: string; cachedAt: number }> = {};
const routeStopsCache: Record<string, { stops: CachedStop[]; cachedAt: number }> = {};
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes

export const notifyApproachingStudents = onValueWritten(
  {
    ref: "busLocations/{busId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const busId = event.params.busId;
    const location = event.data.after.val() as BusLocation | null;
    if (!location) return;

    const db = admin.database();
    const firestore = admin.firestore();
    const messaging = admin.messaging();
    const now = Date.now();

    // 1. Fetch or resolve the bus document to get routeId
    let routeId = "";
    const cachedBus = busRouteCache[busId];
    if (cachedBus && now - cachedBus.cachedAt < CACHE_TTL_MS) {
      routeId = cachedBus.routeId;
    } else {
      const busSnap = await firestore.collection("buses").doc(busId).get();
      if (!busSnap.exists) return;
      routeId = busSnap.data()?.routeId;
      if (!routeId) return;
      busRouteCache[busId] = { routeId, cachedAt: now };
    }

    // 2. Fetch or resolve ordered stops for this route
    let stops: CachedStop[] = [];
    const cachedStops = routeStopsCache[routeId];
    if (cachedStops && now - cachedStops.cachedAt < CACHE_TTL_MS) {
      stops = cachedStops.stops;
    } else {
      const stopsSnap = await firestore
        .collection("stops")
        .where("routeId", "==", routeId)
        .orderBy("order", "asc")
        .get();
      if (stopsSnap.empty) return;
      stops = stopsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as { lat: number; lng: number; order: number; name: string }),
      }));
      routeStopsCache[routeId] = { stops, cachedAt: now };
    }

    // 3. Find which stop the bus is currently near (the "current" stop)
    let currentStopIndex = -1;
    for (let i = 0; i < stops.length; i++) {
      const dist = haversineMeters(
        location.lat,
        location.lng,
        stops[i].lat,
        stops[i].lng,
      );
      if (dist <= NOTIFY_RADIUS_M) {
        currentStopIndex = i;
        break;
      }
    }
    if (currentStopIndex < 0) return;

    // 4. The "target" stop is STOPS_AHEAD ahead of the current stop
    const targetIndex = currentStopIndex + STOPS_AHEAD;
    if (targetIndex >= stops.length) return;
    const targetStop = stops[targetIndex];

    // 5. Dedup — check RTDB first to avoid expensive Firestore queries!
    const lastSentRef = db.ref(`notificationLogs/${busId}/${targetStop.id}`);
    const lastSentSnap = await lastSentRef.get();
    const lastSent = (lastSentSnap.val() as number | null) ?? 0;
    if (now - lastSent < DEDUP_WINDOW_MS) return;

    // Update the deduplication timestamp immediately to prevent race conditions
    await lastSentRef.set(now);

    // 6. Find students assigned to the target stop with FCM tokens
    const studentsSnap = await firestore
      .collection("students")
      .where("busId", "==", busId)
      .where("stopId", "==", targetStop.id)
      .where("active", "==", true)
      .get();
    if (studentsSnap.empty) return;

    const tokens: string[] = studentsSnap.docs
      .map((d) => d.data().fcmToken as string | undefined)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    if (tokens.length === 0) return;

    // 7. Also check RTDB presence — only notify students who are currently WAITING
    const presenceSnap = await db.ref("approachingStudents").child(busId).get();
    const waitingUids = new Set<string>(
      presenceSnap.exists()
        ? Object.values(presenceSnap.val() as Record<string, { uid?: string }>)
            .map((v) => v?.uid)
            .filter((uid): uid is string => typeof uid === "string")
        : [],
    );

    const targetTokens = studentsSnap.docs
      .filter((d) => waitingUids.has(d.data().uid as string))
      .map((d) => d.data().fcmToken as string | undefined)
      .filter((t): t is string => typeof t === "string" && t.length > 0);

    // Fall back to all tokens if no one is in WAITING state (covers offline students)
    const finalTokens = targetTokens.length > 0 ? targetTokens : tokens;

    // 8. Send FCM multicast
    const stopsAwayLabel = `${STOPS_AHEAD} stops`;
    const message = {
      tokens: finalTokens,
      notification: {
        title: "🚌 Bus approaching!",
        body: `Your bus is ${stopsAwayLabel} away — heading to ${targetStop.name}.`,
      },
      data: { busId, stopId: targetStop.id, stopName: targetStop.name },
      android: { priority: "high" as const },
      apns: { payload: { aps: { contentAvailable: true, sound: "default" } } },
      webpush: {
        notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
        fcmOptions: { link: `/bus/${busId}` },
      },
    };

    try {
      const result = await messaging.sendEachForMulticast(message);
      console.info(
        `[FCM] Bus ${busId} → stop ${targetStop.name}: sent ${result.successCount}/${finalTokens.length}`,
      );
    } catch (err) {
      console.error("[FCM] sendEachForMulticast failed", err);
    }
  },
);
