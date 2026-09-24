// Module: lib/goneJobs.ts
//
// Detects job-detail URLs whose job has expired (is_active = false) so the
// middleware can answer 410 Gone instead of a 404. Next.js 14 pages cannot
// set a 410 status themselves (notFound() is always 404), so this runs in
// middleware, before rendering.
//
// Backed by a single shared "gone" set (GET /api/jobs/gone-ids), refreshed
// on a timer, rather than one cached lookup per job ID. Vercel's
// serverless/edge instances are ephemeral and there are many of them, so a
// per-ID cache doesn't amortize across the fleet -- every cold instance
// re-fetches the same job's status. One shared set means one API call per
// instance per refresh window, covering every job, instead of one call per
// unique job ID per instance.
//
// Fails open: any API error, timeout or unexpected response means "not gone",
// so the page renders/404s exactly as it did before this existed.

import { internalApiHeaders } from './internalApi';

const JOB_DETAIL_PATH = /^\/(jobs|internships|remote-jobs|government-jobs)\/([^/]+)\/?$/;
// Crawler ids are sha256(...)[:16] (crawler/src/utils.py make_job_id).
const JOB_ID = /^[a-f0-9]{16}$/i;

const API_BASE_URL =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';

const TIMEOUT_MS = 1500;
const REFRESH_TTL_MS = 10 * 60 * 1000;

let goneSet: { ids: Set<string>; expires: number } | null = null;
// Dedupes concurrent refreshes -- several requests hitting a cold instance
// at once should trigger exactly one fetch, not one each.
let inflight: Promise<Set<string>> | null = null;

/** '/jobs/some-title-acme-0123456789abcdef' -> '0123456789abcdef', else null. */
export function jobIdFromDetailPath(pathname: string): string | null {
    const match = JOB_DETAIL_PATH.exec(pathname);
    if (!match) return null;
    const id = match[2].split('-').pop() ?? '';
    return JOB_ID.test(id) ? id.toLowerCase() : null;
}

export function clearGoneJobCache(): void {
    goneSet = null;
    inflight = null;
}

async function fetchGoneIds(fetchImpl: typeof fetch): Promise<Set<string>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        // No since_days: the API returns every deactivated job (newest
        // first, capped by its own GONE_IDS_MAX_ROWS), not just the last 30
        // days. A job that expired further back than that used to fall out
        // of this set, so the middleware stopped answering 410 for it and
        // the page fell through to a plain 404 -- a weaker "gone" signal to
        // Google that undid the point of 410ing it in the first place.
        const url = `${API_BASE_URL}/api/jobs/gone-ids`;
        const res = await fetchImpl(url, {
            cache: 'no-store',
            headers: internalApiHeaders(url),
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`gone-ids ${res.status}`);
        const body = (await res.json()) as { ids?: string[] };
        return new Set((body?.ids ?? []).map((id) => id.toLowerCase()));
    } finally {
        clearTimeout(timer);
    }
}

export async function isJobGone(
    id: string,
    fetchImpl: typeof fetch = fetch,
    now: number = Date.now(),
): Promise<boolean> {
    if (goneSet && goneSet.expires > now)
        return goneSet.ids.has(id.toLowerCase());

    if (!inflight) {
        inflight = fetchGoneIds(fetchImpl)
            .then((ids) => {
                goneSet = { ids, expires: now + REFRESH_TTL_MS };
                return ids;
            })
            .catch(() => {
                // Fail open. Deliberately NOT cached as an empty set -- a
                // transient API hiccup should retry on the next request, not
                // be remembered as "nothing is gone" for a full TTL window.
                return new Set<string>();
            })
            .finally(() => {
                inflight = null;
            });
    }

    try {
        const ids = await inflight;
        return ids.has(id.toLowerCase());
    } catch {
        return false;
    }
}

export function goneHtml(): string {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>This listing has expired</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem">
<h1>This listing has expired</h1>
<p>The employer has closed this position or it is no longer accepting applications.</p>
<ul>
<li><a href="/jobs">Browse jobs</a></li>
<li><a href="/internships">Browse internships</a></li>
<li><a href="/remote-jobs">Remote jobs</a></li>
<li><a href="/government-jobs">Government jobs</a></li>
</ul></body></html>`;
}
