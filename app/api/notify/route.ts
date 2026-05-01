// POST /api/notify
// Server-side endpoint to send an FCM push notification to one or more devices.
// Called by Cloud Functions or trusted server-side code only.
// Protected by a shared NOTIFY_SECRET env var — not exposed to clients.

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const NOTIFY_SECRET = process.env.NOTIFY_SECRET;

type NotifyBody = {
  /** FCM registration tokens to target. Max 500 per call (FCM limit). */
  tokens: string[];
  title: string;
  body: string;
  /** Optional data payload forwarded to the notification click handler. */
  data?: Record<string, string>;
};

export async function POST(req: NextRequest) {
  // Guard: reject if secret is not configured or doesn't match
  const authHeader = req.headers.get("authorization");
  if (!NOTIFY_SECRET || authHeader !== `Bearer ${NOTIFY_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tokens, title, body: msgBody, data } = body;
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return NextResponse.json({ error: "tokens must be a non-empty array" }, { status: 400 });
  }
  if (!title || !msgBody) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  // firebase-admin messaging
  const adminApp = (await import("firebase-admin/app")).getApps()[0];
  if (!adminApp || !adminAuth) {
    return NextResponse.json({ error: "Firebase Admin not initialized" }, { status: 503 });
  }

  try {
    const { getMessaging } = await import("firebase-admin/messaging");
    const messaging = getMessaging(adminApp);

    // Batch into chunks of 500 (FCM sendEachForMulticast limit)
    const CHUNK = 500;
    const results: { successCount: number; failureCount: number } = {
      successCount: 0,
      failureCount: 0,
    };

    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body: msgBody },
        data: data ?? {},
        android: { priority: "high" },
        apns: { payload: { aps: { contentAvailable: true, sound: "default" } } },
        webpush: {
          notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
          fcmOptions: { link: data?.busId ? `/bus/${data.busId}` : "/dashboard" },
        },
      });
      results.successCount += response.successCount;
      results.failureCount += response.failureCount;
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("[notify] FCM send error", err);
    return NextResponse.json({ error: "FCM send failed" }, { status: 500 });
  }
}
