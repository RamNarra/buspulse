# Workflows

## Student Workflow
1. Student signs in using Google (domain-validated).
2. Student dashboard loads own profile from Firestore when live mode is configured.
3. Student lands on a map-first dashboard that shows assigned bus derived state.
4. Student can opt in to contribute location while app remains active.
5. Student sees concise live status and next-stop context in the map overlay.

## Parent Workflow (Current)
1. Parent route exists for compatibility and redirects to the student dashboard.
2. Canonical parent-link data model remains in Firestore for phase 2 role UX.

## Admin Workflow (Current)
1. Admin route exists for compatibility and redirects to the student dashboard.
2. Canonical admin-managed entities remain part of the data model for phase 2 workflows.

## Live Tracking Workflow
1. Contributor heartbeat updates `/presence/{uid}`.
2. Location update writes `/trackerCandidates/{busId}/{uid}`.
3. Derivation logic computes confidence-weighted bus state.
4. Viewer UI reads derived state from `/busLocations/{busId}` and `/busHealth/{busId}`.

## Manual Operational Workflow
- Configure Firebase + Maps credentials in `.env.local`.
- Start app in local mode and verify setup status page.
- Confirm project ID gate is `buspulse-493407`.
- Enable real reads/writes once Firebase project resources are created.
