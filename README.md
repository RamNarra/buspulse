# BusPulse

BusPulse is a Firebase-first MVP for college bus live tracking.

Firebase target project: buspulse-493407

## Core Architecture
- Firestore: canonical entities (colleges, buses, routes, stops, students, parent links, subscriptions, policies)
- Realtime Database: hot live-tracking layer (presence, candidates, assignments, bus-level derived state)
- Viewer privacy: UI reads bus-level state only; contributor identities are never surfaced to viewers

## Data Source Modes
- live mode: enabled when Firebase env values are complete and project ID matches buspulse-493407
- mock mode: automatic fallback when env is incomplete or mismatched
- setup diagnostics are available in /settings

## Scripts
- `npm run dev`: start local development server
- `npm run lint`: run ESLint
- `npm run typecheck`: run TypeScript checks
- `npm run build`: production build
- `npm run validate`: lint + typecheck + build
- `npm run firebase:emulators`: start Firebase emulators (requires Firebase CLI)
- `npm run firebase:rules:deploy`: deploy Firestore + Realtime Database rules
- `npm run firebase:indexes:deploy`: deploy Firestore indexes

## Local Setup
1. Copy `.env.example` to `.env.local`.
2. Fill in Firebase project values and Maps key placeholders.
3. Enable Maps JavaScript API for your browser maps key.
4. Enable Firebase Auth (Google), Firestore, and Realtime Database in your Firebase project.
5. Run `npm install` and `npm run dev`.

Detailed setup steps are in `docs/SETUP.md`.

## Docs
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/WORKFLOWS.md`
- `docs/SECURITY_PRIVACY.md`
- `docs/SETUP.md`

## Notes
- The MVP intentionally supports active-session contribution only.
- No Google Fleet Engine.
- Payments are stubbed via subscription entities for future integration.
- One-active-session enforcement is documented and remains a server-side follow-up.
