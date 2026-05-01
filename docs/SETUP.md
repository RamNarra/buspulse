# Setup

## 1. Prerequisites
- Node.js 20+
- npm 10+
- Firebase project (manual creation in your GCP/Firebase console)
- Target project ID: `buspulse-493407`

## 2. Install
1. `npm install`
2. `cp .env.example .env.local`
3. Fill all `NEXT_PUBLIC_FIREBASE_*` values from Firebase project settings.
4. Ensure `NEXT_PUBLIC_FIREBASE_PROJECT_ID=buspulse-493407`.
5. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` if map tiles are needed.
6. In Google Cloud, enable Maps JavaScript API for the browser key used by BusPulse.

## 3. Firebase Console Steps
1. Create Firebase project and link billing if required.
2. Enable Authentication -> Google provider.
3. Add authorized domains for local + deployed environments.
4. Create Cloud Firestore in production mode.
5. Create Realtime Database in locked mode.
6. Add basic security rules before public testing.

## 4. Required Env Keys
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID=buspulse-493407`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional, fallback exists)
- `NEXT_PUBLIC_ALLOWED_COLLEGE_DOMAINS` (comma-separated, required for domain restriction policy)

## 5. Local Validation
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run dev`

## 6. Manual Checklist
- Confirm `/settings` shows all checklist items complete.
- Confirm Google sign-in works and allowed domains are enforced.
- Confirm Firestore + Realtime DB resources are reachable.
- Confirm dashboard, bus, and parent pages switch from mock mode to live mode.

## 6.1 Browser Maps API Requirements
- Required for current browser map view: Maps JavaScript API.
- Not required for current browser map view: Routes API.
- If the map key or API restriction is invalid, BusPulse now falls back to a polished map preview surface instead of showing raw provider errors.

## 7. Firebase CLI Readiness (Optional)
These are prepared in repo but not required right now:
- Start emulators: `npm run firebase:emulators`
- Deploy rules: `npm run firebase:rules:deploy`
- Deploy indexes: `npm run firebase:indexes:deploy`

## 8. Known External Blockers
These cannot be completed by code scaffolding alone:
- OAuth consent screen/domain verification
- API enablement and billing setup
- Firebase project credential issuance

## 9. Server-Side Follow-Up
- One-active-session enforcement should be implemented in trusted backend logic.
- Firestore reads for parent-linked visibility should be brokered through server APIs for stronger policy control.

## 10. Firebase App Check (Phase 1.4)
App Check rejects unsigned clients before any Realtime Database or Cloud Functions request, eliminating drive-by abuse.

### Setup steps
1. **GCP Console → Security → reCAPTCHA Enterprise**: Create a new key.
   - Type: *Score-based (no CAPTCHA)* (invisible to real users)
   - Domain: your deployed hostname (e.g. `buspulse.vercel.app`)
2. **Firebase Console → App Check → Apps**: click your web app → *Register*.
   - Choose *reCAPTCHA Enterprise* provider → paste the site key.
3. Copy the site key to `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` in `.env.local`.
4. **Firebase Console → App Check → APIs**: enable enforcement for *Realtime Database* and *Cloud Functions*.
5. **Local dev**: leave `NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY` blank.
   The client automatically sets `FIREBASE_APPCHECK_DEBUG_TOKEN = true` when `NODE_ENV !== production`, so the emulator suite and local dev server work without a real key.
6. **Debug token for CI/CD**: generate a debug token in Firebase Console → App Check → your app → *Manage debug tokens*, then set `FIREBASE_APPCHECK_DEBUG_TOKEN=<token>` in your CI environment.
