# BusPulse

**Intelligent Crowdsourced Fleet Tracking for Engineering Colleges.**

BusPulse lets students act as the GPS sensors — no hardware required on buses. The platform derives real-time bus locations, ETAs, and anomaly alerts from student-contributed GPS pings using a leader-election and scoring model.

Live demo: [buspulse-livid.vercel.app](https://buspulse-livid.vercel.app)  
Firebase project: `buspulse-493407`

---

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Next.js 16 App Router + TypeScript + Tailwind CSS | SSR pages, Server Actions, PWA |
| Auth | Firebase Auth (Google Sign-In via `signInWithRedirect`) | College domain gating, custom claims |
| Canonical data | Firestore | colleges, buses, routes, stops, students, parentLinks, subscriptions |
| Live tracking | Firebase Realtime Database | presence, GPS candidates, leader election, derived bus locations |
| Aggregation | Cloud Functions (2nd gen, asia-south1) | Centroid scoring, anomaly detection, BigQuery export |
| Maps | Google Maps JS API + Roads API + Routes API v2 | Snap-to-roads, traffic-aware ETA |
| Observability | Sentry + @vercel/otel + Cloud Trace | Error tracing, distributed spans, SLO dashboards |

### Key Privacy Rule

Viewers **never** receive raw contributor locations. Only the aggregated `busLocations/{busId}` centroid is exposed to the viewer layer.

---

## Roles & Access

| Role | Can see |
|------|---------|
| `student` (Tier 1) | Own assigned bus only |
| `parent` | Linked student's bus only |
| `student` (Tier 2 "God Mode") | All buses in their college |
| `admin` | All buses + fleet health dashboard + invite generation |

---

## Implementation Phases

| Phase | Summary | Status |
|-------|---------|--------|
| 0 | RTDB security rules, session enforcement, role/tier claims | ✅ |
| 1 | Cloud Function aggregator, viewer subscription, interpolation, App Check | ✅ |
| 2 | Geohash sharding, snap-to-roads, Routes API ETA, anomaly detection, BigQuery | ✅ |
| 3 | Admin role guard, health dashboard, real parent linking, skeleton UX, service worker, unit tests | ✅ |
| 4 | Sentry error tracing, OpenTelemetry, Cloud Monitoring SLOs, k6 load tests, cost alerts | ✅ |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in Firebase config, Maps API key, and (optionally) Sentry DSN

# 3. Start development server
npm run dev
```

See [docs/SETUP.md](docs/SETUP.md) for full Firebase project setup including security rules deployment.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (0 errors, 0 warnings enforced) |
| `npm run typecheck` | TypeScript strict check |
| `npm run validate` | lint + typecheck + build |
| `npm test` | Vitest unit tests (40 tests) |
| `npm run test:coverage` | Unit tests with v8 coverage report |
| `npm run test:e2e` | Playwright e2e tests |
| `npm run firebase:emulators` | Start Firebase emulators |
| `npm run firebase:rules:deploy` | Deploy Firestore + RTDB rules |

---

## Load Testing (Phase 4)

k6 scripts in `tests/load/` simulate 5,000 concurrent viewers and 500 GPS contributors.

```bash
# Install k6 (macOS)
brew install k6

# Run viewer load test
k6 run tests/load/k6-viewers.js --env BASE_URL=https://buspulse-livid.vercel.app
```

See [tests/load/README.md](tests/load/README.md) for full instructions and SLO thresholds.

---

## Observability (Phase 4)

| Tool | Purpose | Required env var |
|------|---------|-----------------|
| Sentry | Client + server error capture, session replay | `NEXT_PUBLIC_SENTRY_DSN` |
| @vercel/otel | OpenTelemetry traces (Server Actions, API routes) | Auto-enabled on Vercel |
| Cloud Trace | Distributed tracing export to GCP | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| Cloud Monitoring | SLO dashboards, uptime checks | GCP Console |

---

## Cost Model

See [docs/COSTS.md](docs/COSTS.md) for full breakdown. TL;DR:

- ~$25/mo per active college fleet (10 buses, Maps APIs enabled)
- Marginal cost ~$3.60/bus/mo
- Budget alerts at 50%/80%/100% of $200/mo configured in GCP Billing

---

## Docs

- [docs/PRD.md](docs/PRD.md) — Product requirements
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System design
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — Firestore + RTDB schema
- [docs/WORKFLOWS.md](docs/WORKFLOWS.md) — Student state machine
- [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) — Privacy model
- [docs/SETUP.md](docs/SETUP.md) — Deployment guide
- [docs/COSTS.md](docs/COSTS.md) — Cost model + budget alerts

---

## Non-Negotiables

- No Google Fleet Engine.
- No background tracking claims — contribution is always foreground + explicit.
- `signInWithPopup` is banned — always `signInWithRedirect`.
- Secrets are never hardcoded — use `.env.local` + Vercel environment variables.
- One active session enforced per email via Firestore session token.

