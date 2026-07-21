# BusPulse Agent Guide

## Product Intent
- BusPulse is a live bus-tracking platform for engineering colleges.
- **CRITICAL**: Bus drivers **do not have smartphones**. We use an **Intelligent Crowdsourced Fleet Tracking** model where student devices act as **anonymous bus sensors**.
- Market strictly as **tracking buses**, never tracking individual students. Student devices function solely as anonymous spatial sensors while inside the bus.
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
1. **Hold the Bus (Proximity Matchmaking)**: `WAITING` students broadcast their location to check arrival. `BOARDED` students can see `WAITING` students on their map at upcoming stops. If a waiting student is close, occupants ask the driver to wait.
2. **State Merge & Instant Disconnect**: When a `WAITING` student intersects with the bus location/velocity, they transition to `BOARDED`. If a device leaves the bus corridor (>150m off route) or reaches destination, location contribution **immediately stops**.
3. **Tracker Pool & Leader Election**: To save battery, only 1 active leader (and 1 standby backup) pings high-fidelity GPS (`busLocations`). The system auto-promotes standby `BOARDED` users if the leader drops.
4. **Monetization & RBAC**:
   - Tier 1 (Base Student - ₹50/mo): Locked to assigned bus route within college domain.
   - Tier 2 / Enterprise (Admin / Transport Office - ₹500/mo or Annual): Institutional multi-bus fleet management with college domain controls and explicit approval.

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
