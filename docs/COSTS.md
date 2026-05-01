# BusPulse — Cost Model

Cost estimates are per-college (one active fleet of 20 buses, 500 daily active students).

---

## Google Maps Platform

| API | Usage pattern | Est. cost/mo |
|---|---|---|
| **Roads API** (`snapToRoads`) | 1 req per bus per 5 s × 20 buses × 8 h/day = 115 K req/mo | ~$2.30 |
| **Routes API v2** (`computeRoutes`) | 1 req per 30 s cache miss × 20 buses × 8 h/day = 32 K req/mo | ~$5.60 |
| **Maps JavaScript API** (viewer tiles) | 500 users × 20 map loads/day = 10 K loads/mo | ~$2.80 |
| **Total Maps** | | **~$11/mo** |

Cost guardrail: Roads API is **disabled** unless `ROADS_API_KEY` is set. Routes API gracefully falls back to haversine when `GOOGLE_MAPS_SERVER_KEY` is absent.

---

## Firebase (Spark → Blaze)

| Service | Usage pattern | Est. cost/mo |
|---|---|---|
| **Realtime Database** | 20 buses × 1 KB/write × 2 writes/s = 3.5 GB/mo egress | ~$1.00 |
| **Cloud Functions** (aggregator) | 20 buses × 2 invocations/s × 200 ms = 14.4 M invoc/mo | ~$5.76 |
| **Cloud Functions** (anomaly) | 1 invoc/30 s = 86 K invoc/mo | ~$0.03 |
| **Cloud Functions** (BQ export) | same as aggregator | ~$5.76 |
| **Firestore** (ETA cache) | 32 K reads + 32 K writes | ~$0.07 |
| **Total Firebase** | | **~$12.62/mo** |

---

## BigQuery

| Resource | Usage | Est. cost/mo |
|---|---|---|
| **Storage** | 20 buses × 2 rows/s × 8 h = 1.15 M rows/day × 30 days ≈ 35 M rows × 0.5 KB | ~$0.70 |
| **Queries** (daily scheduled) | < 10 GB scanned | ~$0.05 |
| **Total BQ** | | **~$0.75/mo** |

---

## Summary

| Tier | Monthly cost |
|---|---|
| Base (no map APIs) | ~$13.37 |
| With Roads + Routes API | ~$24.37 |

At the planned pricing (₹50/college/mo ≈ $0.60), these costs **must be subsidised by the God Mode tier** (₹500/mo, ~$6). A fleet of 10+ colleges breaks even.

---

## Cost Control Checklist

- [ ] Set a **GCP Billing budget alert** at 50% / 80% / 100% of monthly budget.
- [ ] Keep `ROADS_API_KEY` unset until the college has a paid subscription.
- [ ] The ETA endpoint has a **30-second Firestore cache** — one Routes API call serves all viewers of the same bus.
- [ ] `exportBusLocationToBigQuery` can be **disabled** (comment out the export in `functions/src/index.ts`) until BigQuery is needed for reporting.
- [ ] Use **Firebase App Check** (Phase 1.4) to prevent API abuse from unsigned clients.

---

## Phase 4 — Budget Alert Setup (GCP CLI)

Requires your billing account ID from **GCP Console → Billing**.

```bash
BILLING_ACCOUNT="XXXXXX-XXXXXX-XXXXXX"   # replace with real ID

gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="BusPulse Monthly Budget" \
  --budget-amount=200USD \
  --threshold-rule=percent=0.5,basis=CURRENT_SPEND \
  --threshold-rule=percent=0.8,basis=CURRENT_SPEND \
  --threshold-rule=percent=1.0,basis=CURRENT_SPEND \
  --notifications-rule-pubsub-topic=projects/buspulse-493407/topics/billing-alerts
```

**What happens at each threshold:**

| Threshold | Trigger | Recommended action |
|-----------|---------|-------------------|
| 50% ($100) | Email alert | Review — likely normal growth |
| 80% ($160) | Email + PagerDuty | Disable non-critical features (BigQuery export) |
| 100% ($200) | Email + PagerDuty | Throttle Routes API; cap at 1 req/60s |

---

## Phase 4 — Cloud Monitoring SLOs

Three SLO policies to create in **GCP Console → Monitoring → SLOs**:

| SLO | Metric | Target |
|-----|--------|--------|
| ETA API latency | `http/server/response_latencies` p95 on `/api/eta/` | < 400 ms |
| RTDB error rate | Firebase RTDB connection errors | < 0.5% per 5-min window |
| App availability | Uptime check on `buspulse-livid.vercel.app` | 99.5% per 30-day window |

Terraform config for these SLOs is out of scope for this repo; configure manually or via
[Cloud Monitoring API](https://cloud.google.com/monitoring/service-monitoring).

---

## Observability Stack Summary (Phase 4)

| Tool | What it covers | Config |
|------|---------------|--------|
| **Sentry** | Client + server JS errors; Source map upload on deploy | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| **@vercel/otel** | OpenTelemetry traces for Server Actions, API routes | Auto via `instrumentation.ts` |
| **Cloud Trace** | Distributed tracing to GCP | Set `OTEL_EXPORTER_OTLP_ENDPOINT` to Cloud Trace endpoint |
| **Cloud Monitoring** | SLO dashboards, uptime, billing alerts | GCP Console |
| **k6** | Synthetic load tests (5K viewers, 500 contributors) | `tests/load/` |
