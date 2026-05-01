# BusPulse Agent Changelog

---

## Entry 4 — Phase 4: Scale & Observability

**Timestamp:** 2026-05-01T00:00:00Z

**Objective:** Add Sentry error tracing, OpenTelemetry distributed tracing, k6 load tests, cost model, budget alerts — and achieve 0 lint warnings/errors across the entire codebase.

**Files Created:**
- `sentry.client.config.ts` — Sentry client SDK init. DSN-gated (no-op when `NEXT_PUBLIC_SENTRY_DSN` unset). Session Replay enabled at 1% / 100%-on-error. Masks all text for FERPA compliance.
- `sentry.server.config.ts` — Sentry server SDK. HTTP integration for Server Action tracing. 10% trace sample rate in prod.
- `sentry.edge.config.ts` — Sentry edge runtime config (middleware / Edge API routes).
- `instrumentation.ts` — Next.js built-in hook. Initialises `@vercel/otel` (OpenTelemetry) + Sentry server in `nodejs` runtime; Sentry edge in `edge` runtime. Exports traces to Vercel Observability or any OTLP endpoint.
- `tests/load/k6-viewers.js` — k6 load test: ramps to 5,000 VUs simulating students loading dashboard + bus page + polling ETA API. Thresholds: p95 < 400 ms, error rate < 0.5%, sustained 10 min.
- `tests/load/k6-buses.js` — k6 load test: 500 VUs each sending GPS contributor pings every 2 s for 5 min. Thresholds: p95 < 200 ms, error rate < 0.5%.
- `tests/load/README.md` — Run instructions, SLO thresholds, CI integration example.

**Files Modified:**
- `next.config.ts` — Wrapped with `withSentryConfig`. Source map upload gated on `SENTRY_AUTH_TOKEN`. Tree-shakes Sentry from client bundle when DSN unset.
- `docs/COSTS.md` — Added Phase 4 sections: GCP budget alert CLI commands, 50/80/100% thresholds, Cloud Monitoring SLO targets, observability stack summary table.
- `.env.example` — Added `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `OTEL_EXPORTER_OTLP_ENDPOINT`.
- `README.md` — Full rewrite: architecture table, role/access matrix, implementation phases table, scripts table, load testing section, observability section, cost summary.

**Lint Warning Fixes (achieving 0 warnings):**
- `components/auth/login-form.tsx` — Removed unused `LogIn` and `Zap` lucide imports.
- `hooks/use-crowdsource-tracking.ts` — Removed unused `serverTimestamp` import.
- `hooks/use-fleet-state.ts` — Removed unused `now = Date.now()` assignment inside RTDB listener.
- `hooks/use-fleet-in-viewport.ts` — Fixed ref-in-cleanup warning: captures `busUnsubsRef.current` and `busDataRef.current` into local variables before cleanup function returns.

**Key Decisions:**
- Used `@vercel/otel` instead of raw `@opentelemetry/sdk-node` for OTEL — first-class Vercel support, zero config for trace export to Vercel Observability.
- Sentry is DSN-gated throughout — zero bundle impact / no errors when DSN env var is absent.
- `withSentryConfig` wraps `nextConfig` in `next.config.ts` with `autoInstrumentServerFunctions: true` to auto-trace all Server Actions.
- k6 scripts simulate realistic 2s contributor ping cadence and 15–30s viewer dwell time.

**Verification:** `npm run validate` → Exit code 0, 0 errors, 0 warnings. `npm test` → 40/40 tests pass. `npx vercel --prod` → Deployed.

---

## Entry 3 — Production Hardening Phase 2.1

**Timestamp:** 2026-04-24T17:05:00Z

**Objective:** Transform the MVP into a production-grade tracking system.

**Files Modified:**
- `lib/utils/geo.ts` — Added `haversineMeters()` and `isLocationOutlier()` utilities
- `hooks/use-crowdsource-tracking.ts` — Full rewrite: Haversine 30m/15s state machine + Leader Election via RTDB transaction
- `hooks/use-fleet-state.ts` — Chronological outlier filtering before centroid calculation
- `components/auth/auth-provider.tsx` — 1-device session enforcement via Firestore session token
- `firestore.rules` — Base/God tier read scoping + sessions collection
- `database.rules.json` — Strict per-UID write rules on all hot-data nodes
- `components/map/bus-map.tsx` — Removed peer location dots (privacy enforcement)
- `app/dashboard/page.tsx` — Removed peer dot layer, surfaced isLeader in HUD

**Key Logic Decisions:**
- Haversine threshold set to 30m with 15s confirmation timer to eliminate false positives
- Leader elected via `runTransaction` — Firebase atomically assigns leader if the seat is empty or stale (>30s)
- Session token written to `Firestore/sessions/{uid}` on login; second login overwrites token and triggers `onSnapshot` kick on first device
- Outlier filter uses implied speed > 33.3 m/s (120 km/h) to reject teleporting GPS pings

**Verification:** `npm run validate` → Exit code 0. `npx vercel --prod` → Deployed to https://buspulse-livid.vercel.app

---

## Entry 2 — Production Hardening Phase 2

**Timestamp:** 2026-04-24T11:56:00Z

**Objective:** Traffic-proof state machine, dead reckoning, visibility-based leader handoff, PWA installability, Hero UX.

**Files Modified:**
- `hooks/use-crowdsource-tracking.ts` — Complete rewrite with:
  - **Speed-Gated Mutual Discovery**: 2+ peers within 20m AND each moving >1.5m/s → BOARDED
  - **Hysteresis**: Once BOARDED, stays BOARDED for 120s (traffic jam tolerance)
  - **Smart Demotion**: If BOARDED and stationary within 40m of a bus stop for >30s → demote to WAITING (likely alighted)
  - **Cold Start**: Solo speed threshold lowered to 1.5 m/s (~5.4 km/h)
  - **Visibility Handoff**: `visibilitychange` event listener forces leader resignation when tab is hidden; `visible` flag written to candidate ping so standby can auto-promote
  - **Wake Lock**: `navigator.wakeLock.request("screen")` acquired only when this user is the active GPS leader; released on leadership loss or unmount
- `hooks/use-fleet-state.ts` — Dead reckoning engine:
  - Velocity vector computed from 2 most recent clean pings (degrees/ms)
  - If no fresh ping for 15s, starts extrapolating position using last velocity
  - Extrapolated buses flagged `estimated: true`; dropped entirely after 2 minutes
  - Tick interval: 2 seconds
- `components/map/bus-map.tsx` — Estimated buses render at 50% opacity with dashed amber border
- `app/layout.tsx` — Full PWA setup: manifest link, apple-touch-icon, theme-color, viewport lock, mobile-web-app-capable
- `public/manifest.json` — PWA manifest (name, icons, start_url, display: standalone)
- `app/dashboard/page.tsx` — Hero Leader Banner: *"🟢 You are powering the radar! X students are relying on your signal."* Glowing teal icon when leader. Peer consensus count shown in status card. Estimated bus warning shown when dead reckoning is active.

**Key Logic Decisions:**
- Mutual Discovery requires BOTH parties to be moving (speed ≥ 1.5 m/s) to prevent false bus formation at stationary bus stops
- Hysteresis compares elapsed time since `lastBoardedAt` ref — this is reset to null on WAITING transition
- Dead reckoning velocity sanity check: implied speed > 33.3 m/s (120 km/h) → velocity zeroed out to prevent runway extrapolation
- Wake Lock only acquired on leadership assumption — non-leaders save battery
- `visible` flag in RTDB candidate allows future leader election code to prefer visible-tab users over hidden-tab users

**Verification:** `npm run validate` → Exit code 0. `npx vercel --prod --yes` → Deployed to https://buspulse-livid.vercel.app (commit: cf7a7a0)

---

## Entry 3 — Production Hardening Phase 2.1

**Timestamp:** 2026-04-24T17:05:00Z

**Objective:** Reduce mutual discovery threshold to 2 students and enable discovery between WAITING peers.

**Files Modified:**
- `hooks/use-crowdsource-tracking.ts` — Updated mirror logic to include `approachingStudents` (WAITING). Now peers in the waiting state can discover each other to trigger the BOARDED transition together when moving. Strictly enforced `MUTUAL_DISCOVERY_PEERS = 2`.

**Key Logic Decisions:**
- Previously, discovery only worked against already BOARDED peers. Now, two WAITING students walking/driving together will both discover each other and transition to BOARDED simultaneously once they hit the speed threshold.
- Combined `trackerCandidates` and `approachingStudents` into a single `peersRef` for unified proximity checking.
