# Changelog

## [0.1.0] - 2026-04-27

### Fixed
- **CRITICAL Vulnerability Fixed**: Added missing backend authorization to `publishDriverLocation` Server Action (`app/actions/driver.ts`). The system now explicitly verifies the caller's ID token against their assigned `busId` in the Firestore `students` collection, preventing arbitrary location spoofing by unauthorized clients.
- **CRITICAL Privacy Leak Fixed**: Removed raw User IDs (`uid`) from publicly exposed Realtime Database mapping paths (`approachingStudents` and `trackerCandidates`). Introduced an opaque ID (`crypto.randomUUID()`) generation per-client combined with a strictly non-public `trackerMappings` RTDB collection, fulfilling pseudo-anonymity while preserving client-driven centroid merges and `onDisconnect()` hook functionalities.
- **CRITICAL RTDB Authorization Fixed**: Modified `database.rules.json` to reject all arbitrary writes to `busLocations` and `busHealth`, effectively making Server Actions the only valid writer to derived paths. Adjusted candidate list rules to enforce that trackers can only maintain their own opaque mapping.
- **Tier Consistency Patch**: Standardized terminology across `firestore.rules`, `lib/access/policies.ts` and `types/models.ts` by renaming tier level `"premium"` to `"god"` to ensure consistent multi-tenant RBAC policies across God Mode clients.

### Added
- `app/actions/derivedState.ts`: Isolated Server Action backend validation for RTDB derived state mutations.
- `IMPLEMENTATION_PLAN.md`: A brutal layout tracking progress of security overhauls as per architecture code review.
- Support for `crypto.randomUUID()` within React-based hooks (`hooks/use-crowdsource-tracking.ts`) for secure tracking identification without compromising cross-session state behavior.