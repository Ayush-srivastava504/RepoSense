# Load testing the Core API

`k6-load-test.js` measures real server capacity (max sustainable request
rate, and where p95 latency / error rate start degrading) using
[k6](https://k6.io).

## Why this needed backend changes first

Three bugs made accurate load testing impossible before this was added:

1. **500s instead of 429s.** The rate limiter raised `HTTPException(429)`
   from inside `app.middleware("http")`. Exceptions raised at that layer
   never reach Starlette's `ExceptionMiddleware` (which is what turns
   `HTTPException` into a proper JSON response) — they propagate out as a
   bare, unhandled 500. Under load, every throttled request looked like a
   server failure instead of "rate limited", which made it impossible to
   tell real capacity from a rate-limiter bug. Fixed in
   `src/middleware/rate_limit.py` by returning a `JSONResponse(429, ...)`
   directly instead of raising.

2. **Wrong client IP behind Cloudflare/proxies.** The limiter previously
   keyed on `X-Forwarded-For` (or `request.client.host`) directly.
   `X-Forwarded-For` can be a client-supplied comma-separated chain, and
   behind Cloudflare the connection IP the app sees is Cloudflare's edge,
   not the visitor. `get_client_ip()` now prefers `CF-Connecting-IP` (set
   by Cloudflare itself, not spoofable by the client), falls back to
   `True-Client-IP`, then the first hop of `X-Forwarded-For`, then the raw
   socket IP.

3. **No way to measure capacity past the rate limit.** The app's own
   50 req/min (per IP) / 200 req/min (per user) limits would throttle a
   load test long before the server itself was under real load — you'd be
   benchmarking Redis `INCR`, not the API. A `LOAD_TEST_BYPASS_KEY` secret
   (`src/configs/config.py`) lets a request carrying a matching
   `X-Load-Test-Key` header skip the limiter entirely. It's off by default
   (empty string) and compared with `hmac.compare_digest` to avoid a
   timing side-channel — set it only in the environment you're testing,
   only for the duration of the test.

## Running it

```bash
# Staging first, always.
LOAD_TEST_KEY=<value of LOAD_TEST_BYPASS_KEY on that env> \
BASE_URL=https://api.staging.intern-flow.in \
MAX_VUS=100 \
  k6 run loadtest/k6-load-test.js
```

- `MAX_VUS` is the peak number of virtual users the ramp climbs to. Start
  low (e.g. 50–100) and raise it across separate runs based on where the
  previous run's p95/error-rate thresholds started failing, rather than
  guessing a big number up front.
- The ramp is staged over ~13 minutes (warm-up → 30% → 60% → 100% → cool
  down) instead of an instant spike. This matters for cost: if AWS
  autoscaling is in front of the API, a staged ramp lets it scale the way
  it would for real organic growth. An instant spike either gets
  needlessly throttled (autoscaler hasn't caught up) or, worse, causes the
  autoscaler to over-provision for a synthetic burst that doesn't reflect
  real traffic — which is exactly the AWS cost spike this test is meant to
  avoid, not cause.

## Reading the results

`handleSummary` prints error rate, 429 rate, and p95/p99 latency. Capacity
is the last stage where p95 stayed under ~2s and the error rate stayed
low — that's your current real ceiling on the current infra. If you need
headroom past that number, that's a scaling (and cost) decision to make
deliberately, not something to discover by accident in production.

Do **not** run this against production without `MAX_VUS` set conservatively
and someone watching CloudWatch/AWS billing alarms during the run, not
just reviewing results after.
