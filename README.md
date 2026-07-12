# 🌌 BusPulse // AI-Native Decentralized Transit Intelligence
> **"Drivers have no devices. Students are the network. The fleet is autonomous."**

BusPulse is an intelligent, decentralized transit mapping and telemetry engine designed for college and municipal fleets operating without dedicated GPS hardware. By transforming commuter smartphones into active mesh telemetry nodes, BusPulse orchestrates real-time tracking, stop-level ETA predictions, and AI-native delay explanation with zero specialized physical tracking infrastructure.

```
                  [ WAITING STATE ]
                         │  (Broadcasts coords & ETA request)
                         ▼
             ┌────────────────────────┐
             │   PROXIMITY ENGINE     │ ◄─── Snap-to-Roads Map Matching
             └───────────┬────────────┘
                         │  (Heading + Velocity intersection check)
                         ▼
                  [ BOARDED STATE ]
                         │
                         ├─► Active Leader ──► High-fidelity RTDB ping
                         └─► Standby Pool  ──► Low-power presence ping
```

---

## ⚡ Cybernetic Core Mechanics

### 🧬 Proximity Matchmaking & State Merge
BusPulse handles live coordinate telemetry using a dynamic state engine:
* **`WAITING` State:** Commuters awaiting arrival broadcast location slices. They are registered under `/approachingStudents` in the Realtime Database and subscribe to high-frequency ETA ticks.
* **`BOARDED` State:** When a commuter's vector (heading + velocity) intersects with the derived bus centroid, they transition instantly to the `BOARDED` state.
* **Tracker Pool & Leader Election:** To conserve commuter battery life, the system runs an active leader election. **Exactly one** boarded device is elected to stream high-fidelity GPS (`busLocations`). Remaining occupants switch to low-power standby. If the leader loses connection, the standby pool auto-promotes a successor in `< 500ms`.

### 🧠 Vertex AI Delay Explainability
* **Real-time Synthesis:** The API `/api/explain/[busId]` reads speed, telemetry confidence, traffic congestion metrics, and active tracking candidate counts, invoking **Gemini 3.5 Flash** on Vertex AI to construct descriptive, human-readable delay summaries.
* **Fallback Guarantee:** A deterministic local heuristic parser intercepts network or quota timeouts to render fallback telemetry diagnostics instantly, guaranteeing 100% service uptime.

### 🗺️ Dark Map Geometry
* **Street Snapping:** Centroids are snapped to the street grid via Google Roads API to smooth out GPS jitter.
* **Traffic-Aware ETAs:** Stop-level ETA predictions consume Google Routes API v2 with `TRAFFIC_AWARE_OPTIMAL` routing preference, utilizing a 30-second Firestore cache to eliminate GCP budget bleed.

---

## 🔒 Zero-Trust Custom Claims & RBAC

All writes on hot RTDB paths are secured using a custom claim mapping layer synced via `/api/auth/sync`:
1. **Google Sign-In** forces redirect via `@sreenidhi.edu.in` accounts.
2. **Server-side validation** maps the user profile against Firestore whitelists.
3. **Custom claims** (`role`, `assignedBusId`, `tier`) are sealed on the JWT.
4. **RTDB security rules** enforce that only users holding the active token claim can write coordinates to `trackerCandidates/$busId` or receive leader keys.

---

## 🛠️ Development & Launch Sequence

### 📦 Setup & Config
1. Clone & install dependencies:
   ```bash
   npm install
   ```
2. Populate `.env.local` using the parameters below:
   ```env
   NEXT_PUBLIC_APP_NAME=BusPulse
   NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS=sreenidhi.edu.in
   
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=buspulse-493407.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=buspulse-493407
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://buspulse-493407-default-rtdb.asia-southeast1.firebasedatabase.app
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```

### 🛰️ Local Operations
* **Launch Dev Server:** `npm run dev`
* **Deploy Database Rules:** `npm run firebase:rules:deploy`
* **Deploy Indexes:** `npm run firebase:indexes:deploy`

### 🧪 Validation Protocol
Ensure all checks pass before pushing commits:
```bash
npm run lint       # Zero-warning ESLint check
npm run typecheck  # Strict TS compiler validation
npm run build      # Next.js production optimize pipeline
npm run validate   # End-to-end local validation suite
```
