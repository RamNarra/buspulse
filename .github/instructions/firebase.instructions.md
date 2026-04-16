# Firebase Instructions

## Data Layer Split
- Firestore canonical collections:
  - `colleges`, `students`, `buses`, `routes`, `stops`, `parentLinks`, `subscriptions`, `roles`, `accessPolicies`
- Realtime Database hot paths:
  - `/presence/{uid}`
  - `/trackerCandidates/{busId}/{uid}`
  - `/trackerAssignments/{busId}`
  - `/busLocations/{busId}`
  - `/busHealth/{busId}`

## Runtime Behavior
- App should not crash when Firebase env vars are missing.
- Display setup instructions and keep fixture-mode UX available.
- Keep contributor-level data private from viewers.

## Security Guardrails
- Add strict Firestore + RTDB security rules before production.
- Restrict sign-in domains and validate role mappings.
- Store only required contributor fields in hot layer.
