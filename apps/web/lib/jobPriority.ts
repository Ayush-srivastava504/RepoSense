import type { Job } from './jobs';

/**
 * Country-based priority bucket for a job, grounded in how the crawler
 * actually tags rows (see services/api/crawler/src/scrapers):
 *  - company_portals.py (top Indian companies — the core of the feed)
 *    never sets `country`, so it's NULL for those rows.
 *  - freejobalert.py / employment_news.py (govt + India listings)
 *    explicitly set country = "India".
 *  - Remote sources (himalayas, remoteok, remotive, weworkremotely,
 *    hiringcafe) set country to "Worldwide" or a specific region and
 *    is_remote = true.
 *  - japan_common.py sets country = "Japan"; europe_common.py sets
 *    country = "Europe".
 *
 * So "India" isn't a single literal string in the data — it's NULL or
 * "India". Bucketing (not just filtering) keeps the existing ranked
 * order (top company / freshness / confidence) intact *within* each
 * bucket, so this only changes ordering between countries.
 */
function bucket(job: Job): number {
  const country = job.country?.trim().toLowerCase();
  if (!country || country === 'india') return 0; // India
  if (job.is_remote) return 1; // Remote (any region)
  if (country === 'japan') return 2; // Japan
  return 3; // Everything else (Europe, other regions)
}

export function isIndiaJob(job: Job): boolean {
  return bucket(job) === 0;
}

/**
 * Stable sort: India-based listings first, then remote, then Japan,
 * then everything else — without disturbing the relative order the
 * API already computed (sort=ranked) inside each bucket.
 */
export function sortIndiaFirst(jobs: Job[]): Job[] {
  return jobs
    .map((job, index) => ({ job, index }))
    .sort((a, b) => {
      const diff = bucket(a.job) - bucket(b.job);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ job }) => job);
}
