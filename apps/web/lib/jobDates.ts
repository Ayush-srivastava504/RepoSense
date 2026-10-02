// Module: lib/jobDates.ts
//
// One place that decides "when was this job posted", used by the visible UI (JobCard,
// JobDetail) AND the JobPosting JSON-LD (structuredData.ts), so the date a visitor reads
// and the datePosted Google reads can never disagree.
//
// Why this exists: ~10k jobs have posted_at NULL. The UI used to read posted_at only, so
// every one of them said "Recently" / "Recent" while the JSON-LD (which already fell back
// to created_at) carried a real date.
//
// Pure functions, no Date.now() and no locale lookups, so output is identical on the server,
// in the browser and across ISR cache hits.

export interface JobDateFields {
    posted_at?: string | null;
    created_at?: string | null;
    last_seen_at?: string | null;
}

function usable(value?: string | null): string | undefined {
    if (!value)
        return undefined;
    return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

/**
 * Date to SHOW visitors: the source's own posted_at, else our created_at (the real
 * first-ingested timestamp, backfilled by migration 016). Never last_seen_at: it moves
 * on every crawl, so a job would claim to be posted "an hour ago" forever.
 * Returns undefined when neither is usable; callers should then omit the date rather
 * than print a vague "Recently".
 */
export function jobPostedDate(job: JobDateFields): string | undefined {
    return usable(job.posted_at) ?? usable(job.created_at);
}

/**
 * Value for JobPosting.datePosted. Same as jobPostedDate() plus last_seen_at as a last
 * resort, because Google requires datePosted and a slightly-off date beats an invalid
 * posting. Behaviour is unchanged from the inline expression it replaces.
 */
export function jobDatePosted(job: JobDateFields): string | undefined {
    return jobPostedDate(job) ?? usable(job.last_seen_at);
}

/**
 * "3 Oct 2026". Fixed locale + UTC so it is deterministic (no server/client or
 * ISR-vs-request drift) and unambiguous (never 10/3/2026 vs 3/10/2026).
 */
export function formatPostedDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    });
}
