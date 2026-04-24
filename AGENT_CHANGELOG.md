# BusPulse Agent Changelog

---

## Entry 1 — Production Hardening Phase 1

**Timestamp:** 2026-04-23T11:25:00Z

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
