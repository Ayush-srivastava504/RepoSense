# loadtest — k6 Load Test

`k6-load-test.js` measures the core API's real capacity — max sustainable
request rate, and where p95 latency / error rate start degrading — using
[k6](https://k6.io).

The ramp is staged (gradual, not an instant spike) so any autoscaler in
front of the API scales the way it would for organic traffic growth. The
test authenticates with a dedicated `X-Load-Test-Key` header to bypass the
app's own rate limiter, so results reflect real server/DB capacity rather
than how fast Redis returns `429`s.

## Usage

```bash
LOAD_TEST_KEY=<value of LOAD_TEST_BYPASS_KEY on the target env> \
BASE_URL=https://api.staging.example.com \
  k6 run loadtest/k6-load-test.js
```

Run against staging first. If running against production, keep `MAX_VUS`
low and watch billing/CloudWatch alarms during the run, not just after.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `BASE_URL` | `http://localhost:8000` | Target API base URL |
| `LOAD_TEST_KEY` | (empty) | Must match `LOAD_TEST_BYPASS_KEY` on the target env to bypass rate limiting |
| `MAX_VUS` | `100` | Peak virtual users; the ramp scales up to this gradually over the staged run |

## What it checks

- Ramps virtual users through warm-up → 30% → 60% → 100% of `MAX_VUS` → cool-down
- Tracks HTTP error rate, `429` (rate-limited) rate, and request duration
- Exercises the jobs-listing endpoint specifically (`jobs_list_duration` metric)
- Thresholds (e.g. `p95 < 2000ms`) act as a "did we find the ceiling
  responsibly" gate — if breached, that's the signal to stop raising
  `MAX_VUS` on the next run rather than pushing further immediately.
