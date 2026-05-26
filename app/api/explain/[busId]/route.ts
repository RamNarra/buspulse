import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFirestore, adminAuth } from "@/lib/firebase/admin";

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "buspulse-493407";

async function getAccessToken(): Promise<string | null> {
  const adminApp = (await import("firebase-admin/app")).getApps()[0];
  if (!adminApp) return null;
  try {
    const cred = adminApp.options.credential;
    if (cred && typeof cred.getAccessToken === "function") {
      const tokenObj = await cred.getAccessToken();
      return tokenObj.access_token;
    }
  } catch (err) {
    console.warn("[explain/route] Failed to get credential token:", err);
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ busId: string }> }
) {
  const { busId } = await params;

  if (!adminDb || !adminFirestore || !adminAuth) {
    return NextResponse.json(
      { error: "Server not initialized." },
      { status: 503 }
    );
  }

  // 1. Authenticate caller
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authHeader.substring(7);
  try {
    await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  try {
    // 2. Read telemetry from RTDB
    const [locSnap, healthSnap] = await Promise.all([
      adminDb.ref(`busLocations/${busId}`).get(),
      adminDb.ref(`busHealth/${busId}`).get(),
    ]);

    if (!locSnap.exists()) {
      return NextResponse.json({
        explanation: "No active signals received. The bus appears to be offline.",
        timestamp: Date.now(),
      });
    }

    const loc = locSnap.val();
    const health = healthSnap.exists() ? healthSnap.val() : {};

    const speed = loc.speed ?? 0;
    const speedKmph = speed * 3.6;
    const status = health.status ?? "healthy";
    const note = health.note ?? "";
    const activeContributors = health.activeContributors ?? 1;
    const updatedAt = loc.updatedAt ?? Date.now();

    // 3. Read metadata from Firestore
    const busSnap = await adminFirestore.collection("buses").doc(busId).get();
    const busData = busSnap.exists ? busSnap.data() : null;
    const busCode = busData?.code ?? busId;
    const routeId = busData?.routeId ?? "";

    let routeName = "Route " + busCode;
    if (routeId) {
      const routeSnap = await adminFirestore.collection("routes").doc(routeId).get();
      if (routeSnap.exists) {
        routeName = routeSnap.data()?.name ?? routeName;
      }
    }

    // 4. Heuristic Fallback Generator (resilience)
    const getHeuristicExplanation = () => {
      if (status === "ghost" || status === "offline") {
        return `Bus ${busCode} is offline with no active student pings on the route.`;
      }
      if (status === "stranded") {
        return `Bus ${busCode} is stationary (speed 0 km/h) on route. Confirming with driver if there is a block.`;
      }
      if (status === "deviated") {
        return `Bus ${busCode} is off-route. Position is being extrapolated.`;
      }
      if (speedKmph < 8) {
        return `Bus ${busCode} is crawling at ${speedKmph.toFixed(1)} km/h, indicating heavy traffic delays on ${routeName}.`;
      }
      return `Bus ${busCode} is running smoothly on route at ${speedKmph.toFixed(1)} km/h.`;
    };

    // 5. Call Vertex AI / Gemini 1.5 Flash
    let explanation = "";
    const accessToken = await getAccessToken();

    if (accessToken) {
      const vertexUrl = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent`;
      
      const body = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are an AI-powered mass transit intelligence operator for college buses. Analyze this real-time telemetry:
Bus Name: ${busCode}
Current Status: ${status}
Route Name: ${routeName}
Active GPS contributors: ${activeContributors}
Note from telemetry: ${note}
Current Speed: ${speedKmph.toFixed(1)} km/h

Write a single-sentence explanation of the bus status or delay in natural, direct language.
Do NOT use AI jargon or state "based on telemetry". Keep it brief (under 18 words) and user-friendly.
If the speed is low, assume traffic. If status is offline, state that it is offline.

Example: "Bus 14 is running 5 minutes late due to traffic; average speed is 10 km/h."`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 60,
          temperature: 0.2,
        },
      };

      try {
        const resp = await fetch(vertexUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000), // Fast timeout for responsiveness
        });

        if (resp.ok) {
          const resJson = await resp.json();
          const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            explanation = text.trim();
          }
        }
      } catch (err) {
        console.warn("[explain/route] Vertex API failed or timed out. Falling back to heuristics.", err);
      }
    }

    if (!explanation) {
      explanation = getHeuristicExplanation();
    }

    return NextResponse.json({
      explanation,
      timestamp: updatedAt,
    });
  } catch (error) {
    console.error("[explain/route] Explanation fetch error:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation." },
      { status: 500 }
    );
  }
}
