# Backend Instructions

## Current Scope
- MVP uses client SDKs with architecture-ready helper layers.
- Critical policy and derived-state logic lives in `lib/access/` and `lib/live/`.

## Access Rules
- Student: own bus only.
- Parent: linked student bus only.
- Admin: all buses.
- Premium visibility expansion is a controlled hook only.

## Service Boundaries
- `lib/access/policies.ts`: role-based visibility checks
- `lib/live/tracking.ts`: presence and candidate submission skeletons
- `lib/live/scoring.ts`: candidate ranking and derived bus location logic
- `lib/live/eta.ts`: ETA utilities and confidence labels

## Next Backend Milestones
- Move write/derive operations to trusted server runtime.
- Enforce policy checks server-side before data reads.
- Add one-active-session enforcement for auth sessions.
