# BusPulse Agent Guide

## Product Intent
- BusPulse is a live bus-tracking platform for engineering colleges.
- **CRITICAL**: Bus drivers **do not have smartphones**. We use an **Intelligent Crowdsourced Fleet Tracking** model using the students themselves.
- Students are categorized into `WAITING` and `BOARDED` states to facilitate a "Hold the Bus" proximity system.
- Viewers must only receive bus-level derived state, never raw contributor identity.

## Tech Stack
- Next.js App Router with TypeScript
- Tailwind CSS
- Firebase Web SDK (Auth via `signInWithRedirect`, Firestore, Realtime Database)
- Zod for validation, React Hook Form for forms
- Zustand for global UI state

## Source of Truth
- Firestore holds canonical entities: colleges, students, buses, routes, stops, parentLinks, subscriptions, roles, accessPolicies.
- Realtime Database holds hot data: presence, approachingStudents (`WAITING`), trackerCandidates (`BOARDED`), trackerAssignments (Leader Election), busLocations, busHealth.

## Core Mechanics
1. **Hold the Bus (Proximity Matchmaking)**: `WAITING` students broadcast their location. `BOARDED` students can see `WAITING` students on their map at upcoming stops. If a waiting student is close, occupants ask the driver to wait.
2. **State Merge**: When a `WAITING` student intersects with the bus location/velocity, they transition to `BOARDED`.
3. **Tracker Pool & Leader Election**: To save battery, only 1 or 2 `BOARDED` students actively ping high-fidelity GPS (`busLocations`). The system auto-promotes standby `BOARDED` users if the leader drops.
4. **Monetization & RBAC**:
   - Tier 1 (Base - ₹50/mo): Locked to college domain. Can only view pre-assigned bus route.
   - Tier 2 (God Mode - ₹500/mo): Can view any bus in the college fleet.

## Build and Validation
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Production build: `npm run build`
- Full validation pipeline: `npm run validate`

## Operating Rules for Agents
- Trust docs in `docs/` first, then inspect source.
- Keep a strict privacy boundary between contributor-level and viewer-level data.
- NEVER use `signInWithPopup`. Always use `signInWithRedirect`.
- Enforce exactly 1 active session per email.
- Do not hardcode secrets; use `.env.local` and `.env.example`.
- Add tests when adding non-trivial business logic.

## File Map
- `app/`: routes and pages
- `components/`: UI components
- `lib/config/`: runtime environment checks
- `lib/firebase/`: Firebase setup and wrappers
- `lib/store/`: Zustand state management
- `types/`: interfaces and Zod schemas
- `docs/`: product and architecture references
