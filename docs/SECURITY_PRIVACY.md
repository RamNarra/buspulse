# Security and Privacy

## Principles
- Minimum data exposure by role.
- Contributor identity never shown to viewers.
- Canonical and hot data layers remain separate.

## Access Rules
- Student can only view assigned bus.
- Parent can only view linked student bus.
- Admin can view all buses.
- Premium-tier broader visibility is a controlled policy hook.

## Auth and Session
- Google sign-in scaffolded with domain restriction checks.
- One-active-session architecture is documented and should be enforced server-side in next phase.

## Firebase Security (Required Before Production)
- Firestore rules must enforce role + document ownership constraints.
- Realtime DB rules must restrict writes to authenticated contributors and approved buses.
- Ensure bus-level read paths do not reveal contributor-level identities.
- Starter rule files are included:
	- `firestore.rules`
	- `database.rules.json`
	- `firestore.indexes.json`
	- `firebase.json`
- Current defaults are intentionally conservative; write access is blocked for most canonical collections pending trusted backend flow.

## Privacy Guardrails
- No persistent background tracking promises.
- Live contribution only while app is active with explicit permission.
- Keep analytics and logs free of sensitive location history by default.
- Viewers must consume derived bus state only (`busLocations`, `busHealth`) rather than contributor candidate identities.
