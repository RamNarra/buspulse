# BusPulse — 100/10 Master Implementation Plan

> Goal: take this repository from a working MVP (current score ~5.5/10) to a globally-scalable, judge-defying transit engine (target 9.5+/10).
> Every item below is grounded in a concrete file/line in this repo. No aspirational fluff.

---

## Phase 0 — Stop the Bleed (Day 0, blocking before any demo)

| # | File | Defect | Fix |
|---|---|---|---|
| 0.1 | `database.rules.json` L19–L37 | Any authed user can write GPS to any `$busId`. The `trackerMappings` table never asserts `busId`. | Add `busId` to mappings, gate `trackerCandidates/$busId/$uuid` `.write` on `root.child('trackerMappings/{uuid}/busId') === $busId`. |
| 0.2 | `database.rules.json` L40–L46 | `trackerAssignments/$busId/leader` `.write: "auth != null"` lets any user hijack leadership for any bus. | Same `busId`-bound mapping check; require `newData.child('uid').val() === auth_mapping_opaqueId`. |
| 0.3 | `hooks/use-fleet-state.ts` L53 | Whole-tree listener (`trackerCandidates`). Linear fanout cost. | Subscribe to `busLocations/` only (after Phase 1 aggregator), or scope to a single `busId` until then. |
| 0.4 | `hooks/use-fleet-state.ts` L113–L121 | Broken speed-sanity gate ⇒ dead reckoning never moves. | Compute projected lat/lng over a real Δt, then haversine. |
| 0.5 | `app/admin/page.tsx` L96–L142, `app/parent/page.tsx` L20–L28, `app/bus/[busId]/page.tsx`, `app/driver/page.tsx` | Demo-ware (fabricated KPIs, fake delay link, dead routes, contradictory driver page). | Gate behind `NEXT_PUBLIC_SHOW_WIP` or delete; replace KPIs with derived values from `useFleetState`. |
| 0.6 | `lib/access/policies.ts` vs `firestore.rules` | `policies.ts` references tier `"god"`, but `subscriptionTierSchema` uses `"god"` — verify Custom Claims actually issue `tier: "god"`. | Add an admin script that mints custom claims; document in `docs/SETUP.md`. |

---

## Phase 1 — The Real-Time Core (Week 1)

### 1.1 Server-side aggregator (replace client averaging)
**Why:** today every viewer recomputes the centroid from raw candidates (`hooks/use-fleet-state.ts` L75–L107). This is `O(viewers × candidates)` work and exposes raw peer GPS to viewers, violating `AGENTS.md` privacy boundary.

**How:**
- New Cloud Function (2nd gen, region `asia-south1`) `onValueWritten(ref('trackerCandidates/{busId}/{uuid}'))`.
- Reuse `deriveLocationFromCandidates` from `lib/live/scoring.ts` (move to `lib/server/scoring.ts` for shared use).
- Apply outlier rejection via `isLocationOutlier` from `lib/utils/geo.ts` L37–L52 — currently **dead code**, wire it in.
- Run Exponential Moving Average (α = 0.4) on (lat, lng, speed) per bus to suppress GPS noise.
- Write the single canonical `busLocations/{busId}` and `busHealth/{busId}` (already shaped in `lib/firebase/realtime.ts` L150–L168).
- Lock RTDB rule: `busLocations` `.write: false`, `busHealth` `.write: false` — already correct in `database.rules.json` L48–L57; **only the function (admin SDK) writes**.

### 1.2 Viewer subscription model
- Clients subscribe **only** to `busLocations/{busId}` (or a geohash shard — see Phase 2).
- Delete `usePeerLocations` ([hooks/use-peer-locations.ts](hooks/use-peer-locations.ts)) for non-leaders. Peer dots are a privacy leak and a fanout amplifier.

### 1.3 Smooth marker interpolation
- New `hooks/use-interpolated-position.ts`: given `(prev, next, prevTs, nextTs)`, runs `requestAnimationFrame` and lerps. Handle bearing with shortest-arc.
- Wire into `<AdvancedMarker>` in [components/map/bus-map.tsx](components/map/bus-map.tsx#L120).
- Hides RTDB tick boundaries; gives the demo its "Uber-feel".

### 1.4 Coalesced uploads + App Check
- Wrap geolocation `watchPosition` (`hooks/use-crowdsource-tracking.ts` L249) in a 2 s throttle and a 5 m / 5° change filter — ~80% upload reduction.
- Enforce **Firebase App Check** (reCAPTCHA Enterprise on web) on RTDB + Functions; eliminates abuse from unsigned clients.

### 1.5 (Optional) IoT path for paying colleges
- Pub/Sub topic `bus-pings` + Cloud Run subscriber that writes to RTDB. Enables hardware GPS dongles later without UI changes.

**Exit criterion:** running 1,000 simulated viewers (Playwright + Firebase emulator) on a single bus consumes <2 MB/s aggregate bandwidth.

---

## Phase 2 — Spatial Intelligence (Week 2)

### 2.1 Geohash sharding for fleet-wide queries
- Compute `geohash5` (~5 km cells) on every `busLocations` write inside the aggregator.
- Maintain index `busesByGeohash/{gh5}/{busId} = updatedAt`.
- Viewer hook `useFleetInViewport(bounds)` resolves bounds → 9 geohash cells → subscribes to those nodes only.
- Replaces `onValue(ref(db, 'trackerCandidates'))` ([hooks/use-fleet-state.ts](hooks/use-fleet-state.ts#L53)) entirely. Solves the 10k-commuter test.

### 2.2 Map-matching (snap-to-roads)
- Inside the aggregator, batch the last N=10 raw centroids per bus; call **Google Maps Roads API** `snapToRoads?interpolate=true` once per ~5 s per bus.
- Persist snapped path in RTDB `busPaths/{busId}` (capped at last 200 pts).
- Eliminates the "bus driving through buildings" jitter that GPS noise causes.

### 2.3 Real ETA — replace `lib/live/eta.ts`
- Today: haversine ÷ 22 km/h ([lib/live/eta.ts](lib/live/eta.ts#L7-L16)). This is not an ETA.
- New: server route `app/api/eta/[busId]/route.ts` that calls **Routes API v2** `:computeRoutes` with `routingPreference=TRAFFIC_AWARE_OPTIMAL` for (current snapped position → next stop).
- Cache: Firestore doc `etaCache/{busId}_{stopId}` keyed on `(roundedLat, roundedLng, stopId)`, TTL 30 s. **One Routes API call serves all viewers of that bus.**
- Cost guardrail: $5/mo per active bus at 30 s cache. Document in `docs/COSTS.md`.

### 2.4 Anomaly detection (ghost buses, route deviation)
- New `lib/server/anomaly.ts`. For each ping, compute perpendicular distance to nearest segment of the route polyline. If > 250 m for > 60 s, raise `busHealth.status = "deviated"`.
- Stationary > 10 min while not at a stop ⇒ `"stranded"`.
- No live contributors for > 5 min on a scheduled active route ⇒ `"ghost"`.
- These three states drive coloured pins on the admin map. **This is the visible "intelligence" judges score.**

### 2.5 Historical analytics
- BigQuery export of `busLocations` writes via Cloud Function. Daily scheduled query: per-stop arrival distribution, mean lateness, p95.
- Enables the admin "Avg. Route Deviation" KPI to be **real** instead of fabricated.

---

## Phase 3 — The Enterprise UI (Week 3)

### 3.1 Real Admin Console
- Replace the mock table in [app/admin/page.tsx](app/admin/page.tsx#L131-L142) with a live Firestore listener over `buses` joined to `busHealth`.
- Real KPIs from BigQuery scheduled query results materialised into Firestore `metrics/{collegeId}/today`.
- Add server-side role check: `getServerSession()` + Custom Claim `role === 'admin'`. Currently the route has zero gate (`app/admin/page.tsx` L21–L24 admits this).

### 3.2 Predictive fleet dashboard
- Map view with bus pins coloured by status (healthy / degraded / deviated / ghost / stranded).
- SLA alerts panel: "Bus 14 has been stranded for 12 min near Kukatpally".
- Heatmap layer of student `WAITING` density per stop, last 7 days.

### 3.3 Real parent linking
- Replace [app/parent/page.tsx](app/parent/page.tsx#L20-L28)'s `setTimeout` mock with Server Action `linkParent(inviteCode)`:
  - Look up `parentInvites/{code}` in Firestore (admin-issued, single-use, expiring).
  - Atomic transaction: mark invite consumed, create `parentLinks/{id}` per existing schema in [types/models.ts](types/models.ts#L46-L55), set custom claim `role: "parent"` + `studentId`.
- Add Firestore composite index on `parentLinks(parentUid, studentId)`.

### 3.4 Reliability UX
- Skeleton loaders per panel (replace the single full-page spinner in [app/dashboard/page.tsx](app/dashboard/page.tsx#L46-L62)).
- "GPS lost — extrapolating" amber banner whenever `busHealth.status` is anything but `"healthy"`.
- Service Worker offline cache for the last known `busLocations` snapshot — page still loads in tunnels.

### 3.5 Tests
- Unit: `lib/live/scoring.ts`, `lib/live/eta.ts`, `lib/utils/geo.ts`, the BOARDED/WAITING transitions of [hooks/use-crowdsource-tracking.ts](hooks/use-crowdsource-tracking.ts) using a mocked geolocation source.
- Integration: Firebase emulator + Playwright, simulating 3 contributors and verifying leader handoff.
- Target ≥ 70% coverage on `lib/`.

---

## Phase 4 — Scale & Observability (Week 4)

- **Sentry** for client + server error tracing.
- **OpenTelemetry → Cloud Trace** spanning Server Action → Admin SDK → RTDB.
- **Cloud Monitoring SLOs:** p95 ETA endpoint < 400 ms, RTDB connection error rate < 0.5%.
- **Load test:** k6 script driving 5,000 simulated viewers + 500 simulated buses against the staging RTDB; published in `tests/load/`.
- **Cost cap alerts** at 50/80/100% of monthly budget.

---

## Mandatory Google Cloud Stack Upgrade

| Capability | Product | Why it wins the Solution Challenge |
|---|---|---|
| Real-time fleet ingestion | **Pub/Sub + Cloud Run** subscriber | Decouples future hardware GPS from the web client; horizontal scale. |
| Hot location store | **Firebase Realtime Database** (current) | Keep — but writes now flow only from the aggregator. |
| Canonical entities | **Firestore** (current) | Keep. Add composite indexes for admin queries. |
| Map-matching | **Google Maps Roads API** | Removes GPS noise visually — judges *see* the difference. |
| ETA | **Routes API v2** (`computeRoutes`, traffic-aware) | Real ETA, not haversine. |
| Spatial queries | **Firestore + geohash5** *(or)* **Bigtable** for billion-row history | Geohash is enough for the demo; Bigtable is the upgrade story. |
| Long-term analytics | **BigQuery** + scheduled queries | Real "average route deviation" KPI. |
| ML lateness prediction (stretch) | **Vertex AI** custom model on BigQuery features | Deliver "ETA confidence interval" — judge wow factor. |
| Abuse prevention | **Firebase App Check** (reCAPTCHA Enterprise) | Plugs the spoofed-GPS attack class. |
| Auth | **Firebase Auth** with **Identity Platform** custom claims | Already in use; formalise `role` and `tier` claims via admin script. |
| Notifications | **FCM** | "Your bus is 2 stops away". |
| Hosting | **Firebase Hosting** + **Cloud Run** for Server Actions | One-region (asia-south1) + CDN. |
| Secrets | **Secret Manager** | Replace any `.env.local` server keys; document in `docs/SETUP.md`. |
| Observability | **Cloud Logging + Trace + Monitoring** | SLO dashboards live during demo. |

---

## Acceptance Gates (per phase)

| Phase | Gate |
|---|---|
| 0 | RTDB rules pass `firebase emulators:exec` security tests; demo-ware pages hidden in prod build. |
| 1 | 1,000-viewer emulator load test < 2 MB/s; marker interpolation visually smooth at 30 fps. |
| 2 | Routes API ETA returned in < 400 ms p95; geohash viewport query subscribes to ≤ 9 nodes. |
| 3 | Admin KPIs sourced 100% from Firestore/BigQuery; parent linking creates a real `parentLinks` doc. |
| 4 | k6 5,000-viewer test sustained for 10 min with error rate < 0.5%. |

---

## File-Level Surgical Targets (quick reference)

- `database.rules.json` — rewrite tracker + leader rules with `busId` binding (Phase 0).
- `hooks/use-fleet-state.ts` — replace whole-tree listener; fix dead-reckoning math (Phase 0 → 1).
- `hooks/use-crowdsource-tracking.ts` — add upload throttle + change-filter; persist mapping with `busId` (Phase 0 → 1).
- `lib/live/eta.ts` — delete the haversine implementation; replace with Routes API client (Phase 2).
- `lib/live/scoring.ts` — wire `isLocationOutlier`; move to `lib/server/scoring.ts` (Phase 1).
- `app/actions/driver.ts` — keep, but downgrade to a fallback path; aggregator becomes authoritative (Phase 1).
- `components/map/bus-map.tsx` — interpolation hook + status-coloured pins (Phase 1 → 3).
- `app/admin/page.tsx` — strip mocks, wire live data + role gate (Phase 0 → 3).
- `app/parent/page.tsx` — replace fake link with Server Action (Phase 3).
- `firestore.indexes.json` — add composites: `parentLinks(parentUid, studentId)`, `buses(collegeId, active)`, `subscriptions(collegeId, status)` (Phase 3).
- `tests/` — add `unit/` directory with vitest for domain logic (Phase 3).

