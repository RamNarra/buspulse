// POST /api/pubsub/gps
//
// Cloud Run / Pub/Sub push subscriber endpoint.
// Receives hardware GPS pings published to a Pub/Sub topic and writes them
// to the RTDB trackerCandidates path — the same path the aggregator reads.
//
// This decouples future hardware GPS dongles (or any server-side GPS source)
// from the web client. When you add a hardware GPS device:
//  1. Have it publish JSON to the Pub/Sub topic "bus-gps-raw".
//  2. Create a Pub/Sub push subscription pointing to this endpoint.
//  3. The existing Cloud Function aggregator picks up the candidates
//     with no other changes.
//
// Message payload (base64-encoded in the Pub/Sub envelope):
// {
//   "busId": "bus-001",
//   "lat": 17.4449,
//   "lng": 78.3498,
//   "speed": 8.3,
//   "heading": 270,
//   "accuracy": 5,
//   "ts": 1714567890000
// }
//
// Authentication:
//  Pub/Sub push uses a service account OIDC token. Verify it here with the
//  Google Auth Library. Set PUBSUB_AUDIENCE to this endpoint's public URL.
//  For now the endpoint is protected by PUBSUB_PUSH_SECRET as a simpler guard.

import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFirestore } from "@/lib/firebase/admin";
import { getSecret } from "@/lib/config/secrets";

const PUBSUB_PUSH_SECRET_NAME = "PUBSUB_PUSH_SECRET";

type GpsPayload = {
  busId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  ts: number;
};

type PubSubEnvelope = {
  message: {
    data: string; // base64-encoded JSON
    messageId?: string;
    publishTime?: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
};

export async function POST(req: NextRequest) {
  // Validate push secret (simple bearer token guard)
  const expectedSecret = await getSecret(PUBSUB_PUSH_SECRET_NAME);
  if (expectedSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let envelope: PubSubEnvelope;
  try {
    envelope = (await req.json()) as PubSubEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let payload: GpsPayload;
  try {
    const decoded = Buffer.from(envelope.message.data, "base64").toString("utf8");
    payload = JSON.parse(decoded) as GpsPayload;
  } catch {
    return NextResponse.json({ error: "Invalid message payload" }, { status: 400 });
  }

  const { busId, lat, lng, speed, heading, accuracy = 20, ts } = payload;

  if (!busId || typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "Missing required fields: busId, lat, lng" }, { status: 400 });
  }

  if (
    lat < -90 || lat > 90 ||
    lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates out of bounds" }, { status: 400 });
  }

  if (!adminDb || !adminFirestore) {
    return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 503 });
  }

  // Write as a TrackerCandidate so the existing aggregator handles it
  const candidateId = `hw_${busId}_${ts}`;
  const candidate = {
    uid: `hardware_gps`,      // sentinel UID for hardware-sourced pings
    busId,
    lat,
    lng,
    heading: heading ?? null,
    speed: speed ?? null,
    accuracy,
    routeMatchScore: 1.0,    // hardware GPS is fully trusted
    submittedAt: ts,
    source: "gps",
  };

  try {
    await adminDb.ref(`trackerCandidates/${busId}/${candidateId}`).set(candidate);
    
    // Write directly to firestore so frontend Map has access to immediate real-time live positions via snapshot
    await adminFirestore.collection("live_buses").doc(busId).set({
      lat,
      lng,
      speed: speed ?? null,
      heading: heading ?? null,
      activePingers: 1,
      estimated: false,
      updatedAt: ts
    }, { merge: true });

    return NextResponse.json({ ok: true, candidateId });
  } catch (err) {
    console.error("[pubsub/gps] RTDB write failed", err);
    return NextResponse.json({ error: "RTDB write failed" }, { status: 500 });
  }
}
