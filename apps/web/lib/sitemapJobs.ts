// Module: lib/sitemapJobs.ts
// Pure helpers for app/sitemap-jobs.xml/route.ts (kept free of Next.js
// imports so they can be unit-tested with `npm run test:sitemap`).

import { canonicalCategoryForJob, canonicalPathForJob } from './slug';
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
    last_seen_at?: string;
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

// ---------------------------------------------------------------------------
// Stage 3: category-split, prioritised job sitemaps.
//
// IMPORTANT: everything below is SITEMAP-ONLY. isIndexableJob() (used by the
// job pages for their robots meta) is deliberately untouched, so a job that
// is left out of the sitemap stays indexable on its own page.
// ---------------------------------------------------------------------------

// Google's protocol limit is 50,000 URLs/file; small files add nothing.
export const SITEMAP_URLS_PER_FILE = 1000;
// A job only earns a sitemap slot while it is this fresh. Age is measured from
// posted_at, falling back to last_seen_at because ~10k jobs have posted_at NULL.
export const SITEMAP_RECENT_DAYS = 14;

export const SITEMAP_CATEGORIES = ['jobs', 'internships', 'remote-jobs', 'government-jobs'] as const;
export type SitemapCategory = (typeof SITEMAP_CATEGORIES)[number];
export type CategorySitemaps = Record<SitemapCategory, SitemapUrlEntry[]>;

/** Sitemap-only priority rule: indexable AND enriched AND recently posted/seen. */
export function isJobForSitemap(job: SitemapJob, now: number = Date.now()): boolean {
    if (!isIndexableJob(job))
        return false;
    if (!job.enriched_overview)
        return false;
    const ref = job.posted_at || job.last_seen_at;
    const t = ref ? new Date(ref).getTime() : NaN;
    if (Number.isNaN(t))
        return false; // can't prove it's recent
    return now - t <= SITEMAP_RECENT_DAYS * 86400000;
}

/** Split priority jobs into the four canonical categories (each job in exactly one). */
export function buildCategorySitemapEntries<T extends SitemapJob>(jobs: T[], now: number = Date.now()): CategorySitemaps {
    const out: CategorySitemaps = { jobs: [], internships: [], 'remote-jobs': [], 'government-jobs': [] };
    const seen = new Set<string>();
    for (const job of jobs) {
        if (!job?.id || seen.has(job.id))
            continue;
        seen.add(job.id);
        if (!isJobForSitemap(job, now))
            continue;
        out[canonicalCategoryForJob(job)].push({
            loc: `${BASE_URL}${canonicalPathForJob(job)}`,
            lastmod: toLastmod(job.posted_at || job.last_seen_at, now),
        });
    }
    return out;
}

export function chunkEntries<T>(items: T[], size: number = SITEMAP_URLS_PER_FILE): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size)
        chunks.push(items.slice(i, i + size));
    return chunks;
}

export function sitemapFileName(category: SitemapCategory, page: number): string {
    return `${category}-${page}.xml`;
}

/** "internships-2.xml" -> { category: 'internships', page: 2 }; anything else -> null. */
export function parseSitemapFileName(file: string): { category: SitemapCategory; page: number } | null {
    const m = /^(jobs|internships|remote-jobs|government-jobs)-([1-9]\d{0,3})\.xml$/.exec(file);
    return m ? { category: m[1] as SitemapCategory, page: Number(m[2]) } : null;
}

/** Absolute URLs of every non-empty category sitemap file, for the sitemap index. */
export function categorySitemapUrls(buckets: CategorySitemaps): string[] {
    const urls: string[] = [];
    for (const category of SITEMAP_CATEGORIES) {
        const pages = chunkEntries(buckets[category]).length;
        for (let page = 1; page <= pages; page++)
            urls.push(`${BASE_URL}/sitemaps/${sitemapFileName(category, page)}`);
    }
    return urls;
}
