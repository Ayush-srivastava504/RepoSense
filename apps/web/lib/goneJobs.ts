// Module: lib/goneJobs.ts
//
// Detects job-detail URLs whose job has expired (is_active = false) so the
// middleware can answer 410 Gone instead of a 404. Next.js 14 pages cannot
// set a 410 status themselves (notFound() is always 404), so this runs in
// middleware, before rendering.
//
// Fails open: any API error, timeout or unexpected response means "not gone",
// so the page renders/404s exactly as it did before this existed.

const JOB_DETAIL_PATH = /^\/(jobs|internships|remote-jobs|government-jobs)\/([^/]+)\/?$/;
// Crawler ids are sha256(...)[:16] (crawler/src/utils.py make_job_id).
const JOB_ID = /^[a-f0-9]{16}$/i;

const API_BASE_URL =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';

const TIMEOUT_MS = 1500;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;

const cache = new Map<string, { gone: boolean; expires: number }>();

/** '/jobs/some-title-acme-0123456789abcdef' -> '0123456789abcdef', else null. */
export function jobIdFromDetailPath(pathname: string): string | null {
    const match = JOB_DETAIL_PATH.exec(pathname);
    if (!match) return null;
    const id = match[2].split('-').pop() ?? '';
    return JOB_ID.test(id) ? id.toLowerCase() : null;
}

export function clearGoneJobCache(): void {
    cache.clear();
}

export async function isJobGone(
    id: string,
    fetchImpl: typeof fetch = fetch,
    now: number = Date.now(),
): Promise<boolean> {
    const hit = cache.get(id);
    if (hit && hit.expires > now) return hit.gone;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetchImpl(`${API_BASE_URL}/api/jobs/${id}/status`, {
            cache: 'no-store',
            signal: controller.signal,
        });
        // 404 = never existed (leave to the normal 404 page); 5xx = unknown.
        if (!res.ok) return false;
        const body = (await res.json()) as { state?: string };
        const gone = body?.state === 'gone';
        if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
        cache.set(id, { gone, expires: now + CACHE_TTL_MS });
        return gone;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
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
