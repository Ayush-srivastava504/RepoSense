// Module: lib/sitemapDates.ts
// Pure helpers for <lastmod> values. Every date comes from real data (a job's posted_at, a blog post's
// updatedAt, a file's last content change). Nothing here ever returns "now": a lastmod that moves without the
// content moving teaches Google to ignore lastmod for the whole site.
import { toLastmod } from './sitemapXml';

/** Newest valid, non-future ISO date in `values`, or undefined when none is usable. */
export function newestLastmod(values: ReadonlyArray<string | undefined | null>, now: number = Date.now()): string | undefined {
    let best: string | undefined;
    let bestT = -Infinity;
    for (const v of values) {
        const iso = toLastmod(v ?? undefined, now);
        if (!iso) continue;
        const t = new Date(iso).getTime();
        if (t > bestT) {
            bestT = t;
            best = iso;
        }
    }
    return best;
}

/** Newest posted_at / created_at among `jobs`. */
export function newestJobDate(
    jobs: ReadonlyArray<{ posted_at?: string | null; created_at?: string | null; content_modified_at?: string | null }>,
    now: number = Date.now(),
): string | undefined {
    return newestLastmod(jobs.flatMap((j) => [j.posted_at, j.created_at, j.content_modified_at]), now);
}
