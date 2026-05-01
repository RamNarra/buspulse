// ── Snap-to-roads helper (Phase 2.2) ─────────────────────────────────────────
// Maintains an in-memory ring buffer of raw centroids per bus and calls
// Google Maps Roads API `snapToRoads` at most once every SNAP_INTERVAL_MS.
// Only runs when the ROADS_API_KEY environment variable is configured.

import * as admin from "firebase-admin";

const SNAP_INTERVAL_MS = 5_000;
const RING_BUFFER_SIZE = 10;
const PATH_MAX_POINTS = 200;

// In-process state — survives across warm invocations per container
const ringBuffers: Record<string, Array<{ lat: number; lng: number }>> = {};
const lastSnapTs: Record<string, number> = {};

/** Push the latest aggregated centroid into the per-bus ring buffer. */
export function pushCentroid(busId: string, lat: number, lng: number): void {
  if (!ringBuffers[busId]) ringBuffers[busId] = [];
  ringBuffers[busId].push({ lat, lng });
  if (ringBuffers[busId].length > RING_BUFFER_SIZE) {
    ringBuffers[busId].shift();
  }
}

type SnappedPoint = { lat: number; lng: number };

/**
 * If enough time has passed and we have at least 2 buffered points, call
 * `snapToRoads`, append the result to `busPaths/{busId}` (capped at
 * PATH_MAX_POINTS), and return the snapped points.
 *
 * Returns null when the call is throttled, the key is absent, or the API
 * request fails — caller treats null as a no-op.
 */
export async function maybeSnapToRoads(
  busId: string,
  db: admin.database.Database,
  now: number,
): Promise<SnappedPoint[] | null> {
  const apiKey = process.env.ROADS_API_KEY?.trim();
  if (!apiKey) return null;

  const buf = ringBuffers[busId];
  if (!buf || buf.length < 2) return null;

  if (now - (lastSnapTs[busId] ?? 0) < SNAP_INTERVAL_MS) return null;
  lastSnapTs[busId] = now;

  const pathParam = buf.map((p) => `${p.lat},${p.lng}`).join("|");
  const url =
    `https://roads.googleapis.com/v1/snapToRoads` +
    `?path=${encodeURIComponent(pathParam)}&interpolate=true&key=${apiKey}`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      snappedPoints?: Array<{
        location: { latitude: number; longitude: number };
      }>;
    };

    if (!data.snappedPoints?.length) return null;

    const snapped: SnappedPoint[] = data.snappedPoints.map((p) => ({
      lat: p.location.latitude,
      lng: p.location.longitude,
    }));

    // Append to persisted path, keep last PATH_MAX_POINTS
    const prevSnap = await db.ref(`busPaths/${busId}`).get();
    const existing: SnappedPoint[] =
      prevSnap.exists() && Array.isArray(prevSnap.val()?.pts)
        ? (prevSnap.val().pts as SnappedPoint[])
        : [];

    const merged = [...existing, ...snapped].slice(-PATH_MAX_POINTS);
    await db.ref(`busPaths/${busId}`).set({ pts: merged, updatedAt: now });

    return snapped;
  } catch {
    return null;
  }
}
