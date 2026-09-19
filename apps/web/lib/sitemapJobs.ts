// Module: lib/sitemapJobs.ts
// Pure helpers for app/sitemap-jobs.xml/route.ts (kept free of Next.js
// imports so they can be unit-tested with `npm run test:sitemap`).

import { canonicalPathForJob } from './slug';
import { isIndexableJob } from './seo/seoMetrics';
import { BASE_URL } from './site';
import { toLastmod, type SitemapUrlEntry } from './sitemapXml';

export { toLastmod };

// The API caps `limit` at 500. A single sitemap file may hold 50,000 URLs.
export const SITEMAP_PAGE_SIZE = 500;
export const SITEMAP_MAX_PAGES = 100;
export const SITEMAP_MAX_URLS = 50000;

type SitemapJob = {
    id: string;
    title: string;
    company: string;
    location?: string;
    salary?: string;
    stipend?: string;
    type?: string;
    is_remote?: boolean;
    is_government?: boolean;
    deadline?: string;
    posted_at?: string;
    is_thin?: boolean;
    enriched_overview?: string;
};

export type JobsPageFetcher<T extends SitemapJob = SitemapJob> = (
    offset: number,
    limit: number
) => Promise<{ jobs: T[]; total: number }>;

// Thrown when we can't be sure the list is complete. The route turns this
// into a 503 so Google keeps its last good copy instead of learning a
// truncated sitemap (which would look like thousands of URLs "vanishing").
export class IncompleteSitemapError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IncompleteSitemapError';
    }
}

/**
 * Fetch every job page, verifying completeness against the API's `total`.
 * getJobsPage() swallows HTTP errors/429s into `{ jobs: [], total: 0 }`, so
 * completeness has to be checked here rather than trusting "short page =
 * done" (the old behaviour silently produced partial sitemaps).
 */
export async function collectAllJobs<T extends SitemapJob>(
    fetchPage: JobsPageFetcher<T>,
    opts: { pageSize?: number; maxPages?: number; concurrency?: number } = {}
): Promise<T[]> {
    const pageSize = opts.pageSize ?? SITEMAP_PAGE_SIZE;
    const maxPages = opts.maxPages ?? SITEMAP_MAX_PAGES;
    const concurrency = opts.concurrency ?? 5;

    const first = await fetchPage(0, pageSize);
    if (first.jobs.length === 0) {
        // Never a legitimate state for this site; treat as an upstream failure.
        throw new IncompleteSitemapError('first page empty (API error, rate limit or outage)');
    }
    const total = Math.max(first.total, first.jobs.length);
    const pages = Math.min(Math.ceil(total / pageSize), maxPages);
    const all: T[] = [...first.jobs];

    for (let start = 1; start < pages; start += concurrency) {
        const idxs = Array.from({ length: Math.min(concurrency, pages - start) }, (_, i) => start + i);
        const results = await Promise.all(idxs.map((p) => fetchPage(p * pageSize, pageSize)));
        results.forEach((res, i) => {
            const p = idxs[i];
            const isLast = p === pages - 1;
            // Every page except the last must be full. The last page may be
            // short (or slightly shorter if jobs expired mid-fetch).
            if (!isLast && res.jobs.length < pageSize) {
                throw new IncompleteSitemapError(
                    `page ${p} returned ${res.jobs.length}/${pageSize} rows (of total ${total})`
                );
            }
            if (isLast && res.jobs.length === 0) {
                throw new IncompleteSitemapError(`last page ${p} returned no rows (total ${total})`);
            }
            all.push(...res.jobs);
        });
    }
    return all;
}

/** Indexable, de-duplicated sitemap entries on the canonical (non-www) host. */
export function buildJobSitemapEntries<T extends SitemapJob>(jobs: T[], now: number = Date.now()): SitemapUrlEntry[] {
    const seen = new Set<string>();
    const entries: SitemapUrlEntry[] = [];
    for (const job of jobs) {
        if (!job?.id || seen.has(job.id))
            continue;
        seen.add(job.id);
        if (!isIndexableJob(job))
            continue;
        entries.push({
            loc: `${BASE_URL}${canonicalPathForJob(job)}`,
            // Only a real date. Jobs without posted_at get NO <lastmod>; a
            // fabricated "now" on every entry teaches Google to ignore lastmod.
            lastmod: toLastmod(job.posted_at, now),
        });
    }
    return entries;
}
