# BusPulse Load Tests (k6)

Phase 4 load tests validate SLO targets before production traffic.

## Prerequisites

Install [k6](https://k6.io/docs/getting-started/installation/):

```bash
# macOS
brew install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

## Scripts

| Script | Simulates | Target |
|--------|-----------|--------|
| `k6-viewers.js` | 5,000 concurrent students watching live bus locations | p95 < 400 ms, error < 0.5% |
| `k6-buses.js` | 500 concurrent GPS contributors pinging every 2s | p95 < 200 ms, error < 0.5% |

## Running Against Staging

```bash
# Viewer load test
k6 run tests/load/k6-viewers.js \
  --env BASE_URL=https://buspulse-livid.vercel.app \
  --env BUS_IDS=BUS-001,BUS-002,BUS-003

# Contributor load test
k6 run tests/load/k6-buses.js \
  --env BASE_URL=https://buspulse-livid.vercel.app \
  --env BUS_COUNT=10
```

## Running Combined (both scripts simultaneously)

```bash
# In two separate terminals:
k6 run tests/load/k6-viewers.js --env BASE_URL=https://buspulse-livid.vercel.app &
k6 run tests/load/k6-buses.js --env BASE_URL=https://buspulse-livid.vercel.app &
wait
```

## SLO Thresholds (Phase 4 acceptance gate)

- `http_req_duration` p95 < **400 ms** for viewer pages
- `eta_latency_ms` p95 < **400 ms** (Routes API cached response)
- `contributor_ping_ms` p95 < **200 ms**
- Error rate < **0.5%** for both scripts
- Sustained at peak load for **10 minutes**

## Interpreting Results

A passing run looks like:
```
✓ http_req_duration.............: p(95)=287ms
✓ error_rate....................: 0.12%
✓ eta_latency_ms................: p(95)=195ms
```

A failing run will show `✗` next to the threshold and exit with code 99.

## CI Integration

Add to your pipeline (example GitHub Actions step):

```yaml
- name: Load test (smoke)
  run: |
    k6 run tests/load/k6-viewers.js \
      --env BASE_URL=${{ vars.STAGING_URL }} \
      --vus 50 --duration 30s
```
