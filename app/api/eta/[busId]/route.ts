import { NextRequest, NextResponse } from "next/server";

import { adminDb, adminFirestore } from "@/lib/firebase/admin";
import { estimateEtaMinutes } from "@/lib/live/eta";
import type { BusLocation, Stop } from "@/types/models";

// ── Constants ─────────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 30_000;
/** Round to ~110 m — same rounding used for the cache key */
const LAT_LNG_PRECISION = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(n: number): string {
  return n.toFixed(LAT_LNG_PRECISION);
}

function cacheDocId(busId: string, stopId: string, lat: number, lng: number): string {
  return `${busId}_${stopId}_${round(lat)}_${round(lng)}`;
}

type EtaCache = {
  etaMinutes: number;
  distanceMeters: number;
  cachedAt: number;
  source: "routes_api" | "haversine";
};

async function readCache(docId: string): Promise<EtaCache | null> {
  if (!adminFirestore) return null;
  try {
    const snap = await adminFirestore.collection("etaCache").doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data() as EtaCache;
    if (Date.now() - data.cachedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeCache(docId: string, payload: EtaCache): Promise<void> {
  if (!adminFirestore) return;
  try {
    await adminFirestore.collection("etaCache").doc(docId).set(payload);
  } catch {
    // Non-blocking — a write failure just means next caller re-fetches
  }
}

/**
 * Call Google Routes API v2 `computeRoutes` for the current bus position →
 * stop and return the result.
 *
 * Returns null when the API key is absent or the call fails.
 * Falls back to `estimateEtaMinutes` (haversine) in that case.
 */
async function callRoutesApi(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): Promise<{ etaMinutes: number; distanceMeters: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!apiKey) return null;

  const body = {
    origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
    destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE_OPTIMAL",
  };

  try {
    const resp = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4_000),
      },
    );

    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      routes?: Array<{ duration?: string; distanceMeters?: number }>;
    };

    const route = data.routes?.[0];
    if (!route?.duration) return null;

    // duration is a string like "300s"
    const seconds = parseInt(route.duration.replace("s", ""), 10);
    if (isNaN(seconds)) return null;

    return {
      etaMinutes: Math.max(1, Math.round(seconds / 60)),
      distanceMeters: route.distanceMeters ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/eta/[busId]?stopLat=&stopLng=&stopId=
 *
 * Returns a traffic-aware ETA in minutes for the bus to reach the given stop.
 * Uses Google Routes API v2 (TRAFFIC_AWARE_OPTIMAL) with a 30-second Firestore
 * cache — one API call serves all viewers of the same bus.
 *
 * Gracefully degrades to haversine ÷ 22 km/h when the API key is absent or
 * the Routes API call fails.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ busId: string }> },
) {
  const { busId } = await params;
  const { searchParams } = request.nextUrl;

  const stopLatStr = searchParams.get("stopLat");
  const stopLngStr = searchParams.get("stopLng");
  const stopId = searchParams.get("stopId") ?? "unknown";

  if (!stopLatStr || !stopLngStr) {
    return NextResponse.json(
      { error: "stopLat and stopLng query parameters are required." },
      { status: 400 },
    );
  }

  const stopLat = parseFloat(stopLatStr);
  const stopLng = parseFloat(stopLngStr);
  if (isNaN(stopLat) || isNaN(stopLng)) {
    return NextResponse.json(
      { error: "stopLat and stopLng must be valid numbers." },
      { status: 400 },
    );
  }

  // 1. Read bus's current location from RTDB
  if (!adminDb) {
    return NextResponse.json(
      { error: "Realtime Database is not configured." },
      { status: 503 },
    );
  }

  let busLocation: BusLocation | null = null;
  try {
    const snap = await adminDb.ref(`busLocations/${busId}`).get();
    if (snap.exists()) {
      busLocation = snap.val() as BusLocation;
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to read bus location." },
      { status: 503 },
    );
  }

  if (!busLocation) {
    return NextResponse.json(
      { error: "Bus location not available — no active contributors." },
      { status: 404 },
    );
  }

  const { lat: busLat, lng: busLng } = busLocation;

  // 2. Check Firestore cache
  const docId = cacheDocId(busId, stopId, busLat, busLng);
  const cached = await readCache(docId);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  // 3. Try Routes API v2
  const apiResult = await callRoutesApi(busLat, busLng, stopLat, stopLng);

  const stop: Stop = {
    id: stopId,
    routeId: "",
    name: "",
    order: 0,
    lat: stopLat,
    lng: stopLng,
    bufferMeters: 100,
  };

  const payload: EtaCache = apiResult
    ? {
        etaMinutes: apiResult.etaMinutes,
        distanceMeters: apiResult.distanceMeters,
        cachedAt: Date.now(),
        source: "routes_api",
      }
    : {
        // Graceful degradation: haversine fallback
        etaMinutes: estimateEtaMinutes(busLocation, stop),
        distanceMeters: 0,
        cachedAt: Date.now(),
        source: "haversine",
      };

  // 4. Cache and return
  await writeCache(docId, payload);
  return NextResponse.json({ ...payload, cached: false });
}
