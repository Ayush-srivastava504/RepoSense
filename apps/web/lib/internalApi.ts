// Module: lib/internalApi.ts
//
// Server-to-server calls from the Next.js tier (SSR, ISR, middleware, sitemaps)
// reach the API from a small pool of shared egress IPs, and the API rate-limits
// unauthenticated traffic per IP (50/min). One busy crawl could therefore make the
// API answer 429 to legitimate page renders. When INTERNAL_API_KEY is set (server
// env only, never NEXT_PUBLIC_), these calls send it as X-Internal-Key and the API
// exempts them from the per-IP limit (services/api/src/middleware/rate_limit.py).
//
// Inert when the variable is unset, and inert in the browser (Next only inlines
// NEXT_PUBLIC_* variables), so shipping this changes nothing until it is configured.

const API_BASE_URL =
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';

export const INTERNAL_KEY_HEADER = 'X-Internal-Key';

export function internalApiHeaders(
    url: string,
    env: Record<string, string | undefined> = process.env,
    apiBase: string = API_BASE_URL,
): Record<string, string> {
    const key = env.INTERNAL_API_KEY;
    if (!key || !url.startsWith(apiBase)) return {};
    return { [INTERNAL_KEY_HEADER]: key };
}
