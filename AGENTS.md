# BusPulse Agent Guide

## Product Intent
- BusPulse is a live bus-tracking MVP for engineering colleges.
- Students are mapped to exactly one bus and can only view that bus.
- Parents can only view the linked student's bus.
- Admin role can manage all entities.
- Viewers must only receive bus-level derived state, never raw contributor identity.

## Tech Stack
- Next.js App Router with TypeScript
- Tailwind CSS
- Firebase Web SDK (Auth, Firestore, Realtime Database)
- Zod for validation, React Hook Form for forms

## Source of Truth
- Firestore holds canonical entities: colleges, students, buses, routes, stops, parentLinks, subscriptions, roles, accessPolicies.
- Realtime Database holds hot data: presence, trackerCandidates, trackerAssignments, busLocations, busHealth.

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
- Do not introduce unsupported background tracking claims.
- Do not hardcode secrets; use `.env.local` and `.env.example`.
- Preserve existing architecture split: canonical layer vs hot live layer.
- Add tests when adding non-trivial business logic.

## File Map
- `app/`: routes and pages
- `components/`: UI components
- `lib/config/`: runtime environment checks
- `lib/firebase/`: Firebase setup and wrappers
- `lib/access/`: visibility and role policy helpers
- `lib/live/`: tracking and confidence derivation helpers
- `lib/mock/`: local fixtures for UI-only development
- `types/`: interfaces and Zod schemas
- `docs/`: product and architecture references

## Manual Setup Boundaries
- Pause and ask the user only for real external blockers:
	- Firebase project credentials
	- GCP API enablement
	- OAuth consent/domain verification
	- Billing upgrades
