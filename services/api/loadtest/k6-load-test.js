/**
 * k6 load test for the Core API (services/api).
 *
 * Goal: find real server capacity (max sustainable req/s and where p95
 * latency / error rate start degrading) WITHOUT spiking AWS cost — i.e.
 * without triggering autoscaling / over-provisioning just to survive an
 * artificial burst. We do this two ways:
 *
 *   1. A slow, staged ramp (not an instant spike) so any autoscaler that
 *      IS in front of the API scales the same way it would for organic
 *      traffic growth, rather than panic-scaling for a synthetic wall of
 *      requests.
 *   2. Bypassing the app's own rate limiter with a dedicated, secret
 *      X-Load-Test-Key header (see middleware/rate_limit.py) so we're
 *      measuring actual server/DB capacity, not just how fast Redis
 *      returns 429s.
 *
 * Usage:
 *   LOAD_TEST_KEY=<value of LOAD_TEST_BYPASS_KEY on the target env> \
 *   BASE_URL=https://api.staging.intern-flow.in \
 *     k6 run loadtest/k6-load-test.js
 *
 * Run this against staging first. If you must run it against prod, keep
 * MAX_VUS low and watch AWS billing alarms / CloudWatch during the run,
 * not just after.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const LOAD_TEST_KEY = __ENV.LOAD_TEST_KEY || '';

// Keep this modest. The point of this test is "what's our real ceiling",
// not "how hard can we hammer prod". Raise MAX_VUS gradually across runs
// once you've seen where errors/latency start climbing, instead of
// jumping straight to a big number.
const MAX_VUS = Number(__ENV.MAX_VUS || 100);

const errorRate = new Rate('errors');
const rateLimited = new Rate('rate_limited_429');
const jobsListDuration = new Trend('jobs_list_duration', true);

export const options = {
  // Staged, gradual ramp — mirrors organic traffic growth rather than an
  // instant spike, so any AWS autoscaling behaves the way it would in a
  // real traffic event instead of over-provisioning for a synthetic burst.
  stages: [
    { duration: '2m', target: Math.round(MAX_VUS * 0.1) }, // warm up
    { duration: '3m', target: Math.round(MAX_VUS * 0.3) },
    { duration: '3m', target: Math.round(MAX_VUS * 0.6) },
    { duration: '3m', target: MAX_VUS },                    // hold at target
    { duration: '2m', target: 0 },                           // cool down
  ],
  thresholds: {
    // These are the "did we find the ceiling responsibly" gates. If error
    // rate or p95 blow past these, that's the signal to stop raising
    // MAX_VUS on the next run rather than pushing further right now.
    http_req_duration: ['p(95)<2000'],
    errors: ['rate<0.05'],
  },
};

const headers = LOAD_TEST_KEY
  ? { 'X-Load-Test-Key': LOAD_TEST_KEY }
  : {};

export default function () {
  const endpoints = [
    `${BASE_URL}/api/jobs/?limit=20`,
    `${BASE_URL}/api/jobs/?limit=20&type=internship`,
    `${BASE_URL}/api/jobs/?limit=20&category=remote`,
    `${BASE_URL}/api/jobs/?limit=20&category=government`,
    `${BASE_URL}/api/jobs/featured`,
  ];

  const url = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(url, { headers, tags: { name: 'jobs_endpoint' } });

  jobsListDuration.add(res.timings.duration);

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  errorRate.add(!ok);
  rateLimited.add(res.status === 429);

  // Small think-time so this looks like real browsing rather than a
  // synchronized hammer — also keeps per-VU request rate realistic, which
  // matters for reading the results as "capacity for real traffic".
  sleep(Math.random() * 1.5 + 0.5);
}

export function handleSummary(data) {
  return {
    stdout:
      '\n=== Load test summary ===\n' +
      `Max VUs: ${MAX_VUS}\n` +
      `Requests: ${data.metrics.http_reqs.values.count}\n` +
      `Error rate: ${(data.metrics.errors ? data.metrics.errors.values.rate * 100 : 0).toFixed(2)}%\n` +
      `429 rate: ${(data.metrics.rate_limited_429 ? data.metrics.rate_limited_429.values.rate * 100 : 0).toFixed(2)}%\n` +
      `p95 latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(0)}ms\n` +
      `p99 latency: ${data.metrics.http_req_duration.values['p(99)'] ? data.metrics.http_req_duration.values['p(99)'].toFixed(0) : 'n/a'}ms\n\n` +
      'Read this as: the last stage where p95 stayed under ~2s AND error\n' +
      'rate stayed low is your real current capacity. Anything past that\n' +
      'point is where you would need to scale infra (and pay for it), not\n' +
      'just tune the rate limiter.\n',
  };
}
