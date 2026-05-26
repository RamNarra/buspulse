# BusPulse: AI-Native Decentralized Transit Intelligence

BusPulse is a decentralized transit mapping and telemetry engine built for municipal and college transit networks where vehicles lack dedicated GPS hardware. By using commuter devices as active network sensors, BusPulse aggregates real-time bus locations, predicts stop-level ETAs, and runs AI-native delay explainability.

**Production Deployment:** [buspulse-livid.vercel.app](https://buspulse-livid.vercel.app)  
**Firebase Target Project:** `buspulse-493407`

---

## ⚡ Architectural Core

### 1. The Proximity Matchmaking & State Merge
BusPulse implements a bidirectional location sharing grid between two states:
* **WAITING State:** Commuters awaiting a bus grant location access. They are pushed to the Realtime Database under `approachingStudents` and receive live bus ETAs.
* **BOARDED State:** When a waiting user's coordinates intersect with the derived bus centroid (matching heading and velocity vectors), the system dynamically auto-merges them into the `BOARDED` state.
* **Consensus GPS (Tracker Pool):** To minimize passenger battery drain, the system elects **exactly one** boarded client as the primary leader to stream high-fidelity GPS to the cloud. All other boarded devices shift into standby. If the leader drops, a new leader is promoted instantly.

### 2. AI-Native Telemetry Explainability
* **Delay Summarization:** Commuters can request a real-time explanation for delay parameters. The Next.js API `/api/explain/[busId]` reads current bus speed, telemetry confidence, and active contributors, and utilizes **Gemini 1.5 Flash** via Vertex AI to return a concise, natural-language explanation.
* **API Resilience:** Includes a local high-fidelity heuristic fallback engine to guarantee SLA-grade descriptions during model timeouts or API quota caps.

### 3. Google Maps Integration
* **Map-Matching:** Telemetry centroids are snapped in real-time to the street grid using **Google Maps Roads API**, eliminating visual jitter.
* **Traffic-Aware ETA:** Stop-level ETAs utilize **Google Routes API v2** with `routingPreference: "TRAFFIC_AWARE_OPTIMAL"` and a 30-second Firestore cache key to keep GCP costs low.

---

## 🔒 Security & User Access Control

We enforce a strict **Custom Claims Policy** via our self-service authentication synchronization endpoint `/api/auth/sync`:
* During Google Sign-In, the provider routes user credentials to `/api/auth/sync`.
* The server validates the token, maps the user to their Firestore profile (or falls back to `students.json` whitelists), sets custom auth claims (`role`, `assignedBusId`, `tier`), and returns a verified token.
* This locks writes on `trackerCandidates/$busId` and `trackerAssignments/$busId` strictly to authorized student occupants.

---

## 🚀 Quick Start

### 1. Requirements & Install
Ensure your local environment is authenticated with the `gcloud` and `firebase` CLIs.
```bash
npm install
```

### 2. Configure Credentials
Copy `.env.example` to `.env.local` and fill in your Firebase configuration parameters:
```env
NEXT_PUBLIC_APP_NAME=BusPulse
NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS=sreenidhi.edu.in

NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=buspulse-493407.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=buspulse-493407
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://buspulse-493407-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Deploy Infrastructure
```bash
# Deploy Firestore & Realtime Database rules
npm run firebase:rules:deploy

# Deploy Firestore composite indexes
npm run firebase:indexes:deploy
```

---

## 🛠️ Validation Pipeline

Before submitting commits, verify code compilation, tests, and formatting:
* `npm run typecheck` — Strict TypeScript compile verification.
* `npm run lint` — ESLint static rules verification.
* `npm run test` — Runs 40 Vitest unit tests over Scoring, Geo, and Anomaly engines.
* `npm run build` — Validates optimized Next.js server-side compilation.
* `npm run validate` — Runs full formatting, typechecking, and compilation pipelines.
