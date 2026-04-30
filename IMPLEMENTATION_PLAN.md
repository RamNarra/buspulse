# BusPulse — 100/10 Master Implementation Plan

> Goal: take this repository from a working MVP (current score ~5.5/10) to a globally-scalable, judge-defying transit engine (target 9.5+/10).
> Every item below is grounded in a concrete file/line in this repo. No aspirational fluff.
> Phases 0–4 are corrective + scaling. Phases 5–8 are the **moonshot** layer — the differentiators that turn this into a category-defining product instead of "another bus tracker".

---

## North Star

> *"Every commuter in every Tier-2/3 city should know — to the second — when their ride arrives, even if the operator owns nothing but tickets."*

We are not building a bus app. We are building **the open spatial graph of mass transit in countries where the operator has zero telematics budget**. The students/commuters are the sensors. The model improves with every kilometre travelled.

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

---

# 🚀 The Moonshot Layer (Phases 5–8)

> Phases 0–4 make the existing app work and scale. Phases 5–8 are the *category-defining* features. These are what put a 9.5+ on the scoreboard.

---

## Phase 5 — Crowd Intelligence & Behavioural Signal (Week 5–6)

The repo already has a unique asset: **`WAITING` and `BOARDED` states per student** (`hooks/use-crowdsource-tracking.ts` L45–L60). Today they're used only to drive the BOARDED tracker pool. They're actually a **demand-signal goldmine**.

### 5.1 Real-time Boarding Predictions ("Will I get a seat?")
- Stream `approachingStudents/{busId}` + `trackerCandidates/{busId}` cardinality into a sliding window aggregator.
- Compute `expectedOccupancyAtStop(busId, stopId)` = currently boarded + waiting upstream of stop − historical alighting rate at that stop.
- Surface in the UI: "🟡 Bus 14 — 38/50 seats predicted at your stop". This is a **judge-killer feature** — no Indian transit app has it.

### 5.2 "Hold the Bus" — Real-Time Driver Negotiation
The PRD already names this; the code never implements it. Build it:
- When a `WAITING` student is < 200 m and < 90 s ETA-ahead of a moving bus, ping all `BOARDED` users with: *"Asha is 80 m behind — wait?"*
- One-tap `/holdBus/{busId}` request writes to RTDB; aggregator counts requests; if quorum (≥ 2) reached in 10 s, trigger an audible cue on the Leader's phone (`speechSynthesis.speak("Hold the bus, one student approaching")`) — driver hears it through the leader's phone speaker.
- **No driver app needed.** This is the crown jewel of the "drivers don't have phones" thesis.

### 5.3 Anomaly Voting (collective ground-truth)
- If ≥ 3 BOARDED students simultaneously hit "Wrong route" / "Detour" / "Stuck", the bus health flips to `"deviated"` instantly — bypassing the 60 s polyline check from Phase 2.4.
- Uses the same opaque-ID privacy model — votes are unattributable.

### 5.4 Phantom Stop Discovery
- Cluster `BOARDED→IDLE` transitions (i.e. alightings) over 30 days. DBSCAN with 25 m radius / min 5 events/day.
- Surfaces clusters as **proposed new stops** in the admin console — "47 students alight here daily, but it isn't on any route". Real product insight, fully data-driven.

---

## Phase 6 — Predictive AI Layer (Week 6–7)

### 6.1 Vertex AI ETA Model (replaces Routes API for known segments)
Routes API gives traffic-aware ETA but doesn't know **your** bus's behaviour (driver style, stop dwell distribution, school-zone slowdowns). Train a model that does.

**Features (per segment, per time-bucket):**
- `dayOfWeek`, `hourOfDay`, `monthOfYear`, `isHoliday`, `weatherCode` (Open-Meteo, free)
- `historicalMeanSpeed_kmph`, `historicalDwellAtStop_s`, `studentBoardCount_lag1`
- `currentTrafficDelta` (Routes API as a *feature*, not the answer)
- `precipitationIntensity_mmh`

**Model:** Gradient Boosted Trees (Vertex AI AutoML Tabular) → 30 s scheduled batch predictions per active route → write into `etaPredictions/{busId}/{stopId}`.

**Stretch confidence interval:** quantile regression p10/p50/p90. UI shows: "Arrives 7 min (±2 min, 90% confidence)". Judges have **never seen** this in a student project.

### 6.2 LLM-Powered "Why is my bus late?"
- Cloud Run endpoint `/api/explain/{busId}` calls **Gemini 1.5 Flash** with the bus's last 10 min of telemetry + traffic deltas + weather + reported anomalies.
- Returns a one-sentence natural-language explanation: *"Bus 14 is 4 min late — moderate traffic on Tank Bund + rain reducing average speed by 18% this hour."*
- **Wow factor with near-zero cost** (Flash is ~$0.0001/call; cache 60 s).

### 6.3 Demand Forecasting (operator product)
- BigQuery → Vertex AI: predict next-day `WAITING` count per (stop, 15-min bucket).
- Output exposed via a **B2B dashboard** for college transport managers ("Add a second bus on Route 7 at 8:15 AM Mondays — 92% confidence demand will exceed capacity").
- This is the **revenue moat** beyond the ₹50/₹500 student tiers.

---

## Phase 7 — Resilience, Privacy & Trust Engineering (Week 7)

### 7.1 Offline-First with Vector Tiles
- Replace Google Maps tiles with **MapLibre GL + MapTiler** (or self-hosted PMTiles on Cloud Storage). Saves cost and lets the map render with **zero network**.
- Cache the user's route polyline + last 50 bus positions in IndexedDB. Tunnels & dead zones now show *"Last seen 3 min ago"* instead of a blank map.

### 7.2 Differential Privacy on Boarding Counts
- Apply Laplace noise (ε = 1.0) to public-facing occupancy counts per stop. Real count is reserved for the operator dashboard.
- Statement to judges: *"We solve the cold-start problem without ever publishing identifiable boarding patterns."* — squarely addresses GSC's privacy rubric.

### 7.3 Battery Budget Protocol
- Today every BOARDED student watches GPS at full power. Implement a **bid-based battery auction**:
  - Each phone reports `batteryLevel` + `isCharging` to RTDB.
  - Leader election prefers chargers > 50% battery. Non-leaders downgrade to 30 s `maximumAge` GPS or pause completely.
  - Net effect: 1 leader at 100% accuracy, all peers at near-zero battery cost. **Currently every peer wastes battery for redundancy that's never used.**

### 7.4 Cryptographic Trust ("Was that really a real bus?")
- Each leader's GPS write is signed with a session key derived from the user's Firebase ID token + a server nonce.
- Aggregator rejects any write whose signature doesn't verify.
- Public dashboard shows a "Verified Stream" badge — defeats spoofers, even if they bypass App Check.

### 7.5 Tamper-Evident Audit Log
- Every leader handoff, every state transition, every override → append-only log in **BigQuery + Merkle root anchored daily to a public Cloud Storage object**. Operators / parents can audit retroactively.

---

## Phase 8 — Ecosystem & Crazy-but-Real Bets (Quarter 2+)

### 8.1 Open Transit Graph API
- Publish `/api/v1/feed` as **GTFS-Realtime** (Protocol Buffers). Free read access for any app.
- Suddenly: Google Maps, Apple Maps, Citymapper, Moovit — all show your buses. **Distribution inversion.** You become the upstream data provider, not a downstream consumer.

### 8.2 Bus-to-Bus Mesh (Bluetooth LE)
- When a phone is BOARDED, broadcast a tiny BLE packet (`opaqueId`, `busId`, `seq`). Receivers within 10 m record encounters.
- Use cases:
  - **Sub-meter co-location verification** — eliminates GPS confusion between two buses on the same road (a chronic problem in dense corridors).
  - **Free Wi-Fi-less ridership counting** — count distinct opaqueIds heard during a trip.
  - **Tunnel survival** — leader can still publish `(lastGPS + dt)` enriched with peer-confirmed presence.

### 8.3 Driver Hardware Companion (₹400 ESP32-C3)
- For colleges willing to invest minimally, ship a **₹400 ESP32-C3 + GPS module** that publishes to Pub/Sub via the college Wi-Fi at depot + cellular at run.
- Same Firestore canonical store; aggregator just gets a high-confidence channel.
- Reframes "drivers don't have phones" → "drivers don't *need* phones, but if you have ₹400, here's an upgrade".

### 8.4 Carbon Receipt
- After each ride, compute `co2_saved_g = (avg_car_co2 − bus_co2_per_seat) × distance_km`.
- Send weekly digest: *"You saved 4.2 kg CO₂ this week. That's 18 trees-hours."*
- Optional: mint a **CarbonPass** soulbound token on a public ledger for verifiable green credentials. (Stretch — flag as nice-to-have.)

### 8.5 Voice-First Dashboard ("BusPulse Tara")
- Twilio Voice number + Gemini Voice → call/SMS the bus number, get an instant voice ETA. Critical for parents who don't use smartphones — exactly the user base our problem statement addresses.
- "Send 'BUS TS08UB1234' to 9XXXX-XXXXX" → SMS reply with ETA. Cost: ~₹0.20/SMS, free with Twilio trial.

### 8.6 Cross-College Federation
- A BusPulse-enabled student from College A who happens to board a College B bus contributes anonymously to College B's tracker pool (with both colleges' consent).
- Network effects: every new college multiplies coverage of every other.

### 8.7 Game Layer ("BusPulse Streak")
- Reward consistent contributors with college-specific perks (canteen discounts, library priority). Operator-funded micro-loyalty.
- Leaderboard: top GPS contributors per route per week. Gamification combats the contribution-decay curve every crowdsourced system fights.

### 8.8 Disaster Mode
- Manual admin toggle: `disaster=true`. Switches every BOARDED student to high-frequency reporting, broadcasts last-seen positions of every bus, opens the feed publicly without auth. Targets flood / strike / heatwave scenarios where transit visibility = lifesaving.

---

## Brainstorm Backlog (Crazy Ideas That Need Vetting)

- **Stop "I'm here" beacon** — a printed QR at every stop, scanning it auto-promotes WAITING with verified location. Defeats GPS noise at concrete-walled stops.
- **Wind/Weather routing** — bus routes affected by floods could auto-reroute via Routes API alternatives + admin override; predictions pushed via FCM.
- **AR walk-to-bus** — when you arrive at a stop early, AR arrow overlay points at where the bus will pull in (after we have map-matched lane data).
- **Auto-attendance** — colleges optionally consume `BOARDED` events to mark attendance for the *journey*, not the class. Eliminates fudged attendance.
- **Insurance partnership** — verified ridership data is monetisable to micro-insurance providers (per-trip injury cover at ₹0.50/ride).
- **Public city dashboard** — like flightradar24 but for the city's college fleet + (eventually) public buses. Open data == press coverage == hiring magnet.
- **Reverse mode** — empty bus, no students. Driver phone (if deployed) or onboard ESP32 acts as the lone tracker. Same architecture, different signal source.
- **Fairness scoring** — flag routes where a sub-population (girls' hostel, late-shift) gets systematically worse service. Operator dashboard surfaces it; PR gold.
- **Federated learning** — student phones contribute model gradients (not raw data) to improve the ETA model on-device. Privacy + accuracy compounding.
- **Strike/protest map** — `BOARDED → IDLE` mass-transitions in non-stop locations cluster-detect protests/incidents in near real-time. Dual-use; needs governance.

---

## Updated Tech-Stack Add-Ons (Phases 5–8)

| Capability | Product | Phase |
|---|---|---|
| LLM explanations | **Gemini 1.5 Flash via Vertex AI** | 6.2 |
| ETA model training | **Vertex AI AutoML Tabular** + BigQuery feature store | 6.1 |
| Demand forecasting | **Vertex AI Forecasting** | 6.3 |
| Voice / SMS | **Twilio Programmable Voice & SMS** + Gemini Voice | 8.5 |
| Open-data feed | **GTFS-Realtime** spec, served from Cloud Run | 8.1 |
| BLE mesh | Web Bluetooth API (browser-side) | 8.2 |
| Vector tiles offline | **MapLibre GL + MapTiler / PMTiles on GCS** | 7.1 |
| DP noise | `google-differential-privacy` (Java/Go via Cloud Run sidecar) | 7.2 |
| Tamper-evident log | **BigQuery + Cloud Storage** with daily Merkle anchoring | 7.5 |
| Edge hardware (optional) | **ESP32-C3 + Pub/Sub Lite** | 8.3 |

---

## Demo Storyboard for Judges (revised after moonshot)

1. **The Hook (10 s)** — "Imagine a city where 4,000 buses serve a million students with **zero GPS hardware**. Watch."
2. **The Mechanism (45 s)** — Open two laptops, both as students on Bus 14. Show leader election, sticky BOARDED, peer markers vanish (privacy boundary).
3. **The Intelligence (45 s)** — Click "Why is my bus late?" → Gemini answer in 800 ms. Show ETA confidence band. Show occupancy prediction.
4. **The Crowd-Power (30 s)** — Simulate a `WAITING` student near a bus. Tap "Hold the Bus". Leader's phone speaks aloud. **Audible drop-mic.**
5. **The Scale (20 s)** — Open k6 dashboard: 5,000 simulated viewers, 500 buses, 99.7% sub-second update latency. Then flip to GTFS-Realtime feed in Citymapper running on a phone.
6. **The Closer (10 s)** — Show the open-data API + carbon receipts + voice number. *"BusPulse is the spatial graph of mass transit. The students built it. The cloud carries it. The city benefits."*

---

## Risk Register (the things that will eat us alive if ignored)

| Risk | Mitigation | Phase |
|---|---|---|
| Battery drain → contributors stop opting in | Bid-based battery auction (7.3) + leader-only high-power GPS | 7 |
| Coordinated GPS spoofing | App Check + signed writes (7.4) + outlier rejection in aggregator (1.1) | 1, 7 |
| Privacy regulator (DPDPA 2023, India) | DP noise on public counts (7.2), opaque IDs (already), 7-day retention default | 7 |
| LLM hallucination on "why late?" | Constrain Gemini prompt to deterministic features only; show source values inline | 6 |
| Routes API cost explosion | 30 s cache per (bus, stop), batch up to 25 destinations per call | 2 |
| Leader handoff oscillation in tunnels | Hysteresis + BLE mesh confirmation (8.2) | 7, 8 |
| College admin onboarding friction | One-click student-roster CSV import + invite SMS via Twilio | 3, 8 |
| Adversarial DOS via auth-mass-create | Firebase App Check + per-IP rate limit at Cloud Armor | 0, 4 |

---

## Definition of Done — The 9.5/10 Shape

A judge running `npm run validate && npm run dev` against a fresh Firebase project must, in under 10 minutes, see:

1. Two browser tabs as students → live leader election.
2. A WAITING student → "Hold the Bus" → audible cue on the leader.
3. ETA shown with confidence interval, and a "why?" button that calls Gemini.
4. Admin dashboard with **real** KPIs derived from BigQuery.
5. The same bus visible inside Google Maps via the open GTFS-Realtime feed.
6. A k6 load test running 1,000 viewers + 100 buses sustained on free-tier Firebase emulator.

When all six are live — we are not asking for the prize. We are accepting it.

