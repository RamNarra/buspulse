# BusPulse Copilot Instructions

## Read Order
1. Trust docs in `docs/` first.
2. Search source code second.
3. Update docs whenever architecture or behavior changes.

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS
- Firebase Web SDK (Auth, Firestore, Realtime Database)
- Zod + React Hook Form

## Build Commands
- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Validate: `npm run validate`

## Folder Map
- `app/`: routes and page shells
- `components/`: reusable UI modules
- `hooks/`: browser-side hooks
- `lib/config/`: runtime/env diagnostics
- `lib/firebase/`: Firebase client wrappers
- `lib/access/`: role and policy helpers
- `lib/live/`: contribution, scoring, and ETA derivation logic
- `lib/mock/`: UI fixtures and local-only demo data
- `types/`: shared Zod schemas and interfaces
- `docs/`: product and architecture docs

## Non-Negotiables
- Firestore is canonical data only.
- Realtime Database is the hot live-tracking layer only.
- Never expose raw contributor identity in viewer-facing UI.
- Student can view only assigned bus.
- Parent can view only linked student bus.
- Admin can view all buses.
- No unsupported background tracking claims.
- Do not use Google Fleet Engine.
- Never hardcode secrets.

## Coding Rules
- Prefer composable utilities over large classes.
- Keep comments sparse and high-signal.
- Add or update tests for non-trivial domain logic.
- Keep route/page modules lightweight and move logic to `lib/`.

## Validation Before Done
- Run lint, typecheck, and build.
- If external credentials block full behavior, document exact manual steps in `docs/SETUP.md`.
