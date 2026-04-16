# Architecture

## Overview
BusPulse uses a Firebase-first split architecture:
- Firestore for canonical transport entities and access metadata.
- Realtime Database for hot presence and derived live bus state.
- Runtime mode gate:
	- live mode when Firebase env is complete and project ID matches buspulse-493407
	- mock mode fallback otherwise

## Canonical Layer (Firestore)
Collections:
- `colleges`
- `students`
- `buses`
- `routes`
- `stops`
- `parentLinks`
- `subscriptions`
- `roles`
- `accessPolicies`

## Hot Layer (Realtime Database)
Paths:
- `/presence/{uid}`
- `/trackerCandidates/{busId}/{uid}`
- `/trackerAssignments/{busId}`
- `/busLocations/{busId}`
- `/busHealth/{busId}`

## Runtime Flow
1. Eligible active-session client sends heartbeat + location candidate.
2. Candidate scoring ranks by freshness, accuracy, and route match.
3. Derived bus location is computed from top candidates.
4. Viewer UI consumes only derived bus state and ETA cards.

## Wired Client Flows
- Auth: Google sign-in, sign-out, auth-state subscription with domain checks.
- Firestore reads: student profile by uid/id, bus by id, route+stops by bus.
- Realtime reads: subscribe to derived bus state (`busLocations` + `busHealth`) and stale detection.
- Realtime writes: presence heartbeat and tracker candidate contribution while app session is active.

## Current UX Scope
- Student map-first dashboard is the primary live experience.
- `/parent`, `/admin`, and `/bus/[busId]` routes are compatibility paths that redirect to `/dashboard`.
- Parent-link and admin-oriented canonical entities remain in the data model for future role-specific UIs.

## Security and Privacy
- Viewer pages never render contributor identity.
- Access policy helpers enforce role-scoped bus visibility.
- Session strategy and strong server-side enforcement are documented for next phase.

## Extensibility
- Replace fixture reads with Firestore queries incrementally.
- Move derive-and-publish operations to trusted server process.
- Add role-based server APIs with strict Firebase rules.
- Add one-active-session enforcement in server logic.
