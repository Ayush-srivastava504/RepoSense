// Module: lib/fetchWithTimeout.ts
// Defines function(s): fetchWithTimeout
//
// Plain `fetch()` has NO default timeout in Node — if the backend
// (api.intern-flow.in) is slow, unreachable, or just not warmed up yet
// during a Vercel build, an un-timed-out fetch call hangs indefinitely.
// Next.js's "Collecting page data" phase (worker.js's isPageStatic check)
// kills that phase after a hardcoded 60s and retries twice, then fails the
// whole build with "still timing out after 2 attempts" — this hits EVERY
// route that touches getJobs/getCompanies/getHackathons/getJobFacets at
// build time (generateStaticParams, generateMetadata, or the page itself),
// which is why the build log shows nearly every route restarting.
//
// Note: `staticPageGenerationTimeout` in next.config.js does NOT cover this
// — it only bounds the later "generating static pages" phase, not
// "collecting page data". The only real fix is to stop the fetch calls
// themselves from hanging: give every outbound request a hard ceiling well
// under 60s, so a slow/dead backend fails fast and the caller's existing
// try/catch falls back to an empty result instead of the whole build
// stalling.
const DEFAULT_TIMEOUT_MS = 8000;

export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
    const controller = new AbortController();
    // Respect a caller-supplied signal too: if either the timeout or the
    // caller's own abort fires, the request stops.
    const onCallerAbort = () => controller.abort();
    if (options.signal) {
        if (options.signal.aborted) {
            controller.abort();
        } else {
            options.signal.addEventListener('abort', onCallerAbort);
        }
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    }
    catch (err) {
        if (controller.signal.aborted) {
            throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
        }
        throw err;
    }
    finally {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onCallerAbort);
    }
}
