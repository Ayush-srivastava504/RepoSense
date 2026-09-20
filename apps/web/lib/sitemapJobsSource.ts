// Module: lib/sitemapJobsSource.ts
// Server-side source for the category job sitemaps. Kept out of
// lib/sitemapJobs.ts so that file stays free of app imports (unit-testable).
//
// The whole job list is collected ONCE and shared by the sitemap index and every
// category file, via a short in-memory cache plus in-flight de-duplication.
// Without this, each of the 4+ sitemap requests would fan out ~28 API calls of
// its own and could trip the API's 50 requests/minute limit.

import { getJobsPage } from '@/lib/jobs';
import {
    buildCategorySitemapEntries,
    collectAllJobs,
    SITEMAP_CATEGORIES,
    type CategorySitemaps,
} from '@/lib/sitemapJobs';

const TTL_MS = 10 * 60 * 1000;
let cached: { at: number; value: CategorySitemaps } | null = null;
let inflight: Promise<CategorySitemaps> | null = null;

/** Throws IncompleteSitemapError when the API list can't be verified complete. */
export function getCategorySitemaps(): Promise<CategorySitemaps> {
    if (cached && Date.now() - cached.at < TTL_MS)
        return Promise.resolve(cached.value);
    if (!inflight) {
        inflight = (async () => {
            const jobs = await collectAllJobs((offset, limit) => getJobsPage({ limit, offset }));
            const value = buildCategorySitemapEntries(jobs);
            console.log(
                `sitemap-jobs: ${jobs.length} jobs fetched -> ` +
                    SITEMAP_CATEGORIES.map((c) => `${c}=${value[c].length}`).join(' ')
            );
            cached = { at: Date.now(), value };
            return value;
        })().finally(() => {
            inflight = null;
        });
    }
    return inflight;
}
