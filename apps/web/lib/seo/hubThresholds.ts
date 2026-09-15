// Module: lib/seo/hubThresholds.ts
// Defines function(s): belowHubThreshold
//
// PHASE 3 item 2 (PHASE_PLAN.md) — minimum-listing gating for programmatic
// SEO hub pages, matching FresherFlow's SKILL_MIN_JOBS/LOCATION_MIN_JOBS
// gating in staticFeed.service.ts. The audit for this item found that
// /skills/[slug] and /jobs-in/[city] had NO floor at all: a skill or city
// with zero live jobs still rendered a 200-OK, indexable page (with only
// the "no live listings" fallback text as unique content) and still
// appeared in sitemap-skills.xml/sitemap-locations.xml. That's exactly the
// thin/near-duplicate-content pattern that gets a programmatic SEO section
// devalued in aggregate by Google, even though each individual page looks
// harmless.
//
// The fix applied here is a soft gate, not a hard 404: these hub pages
// carry real evergreen content beyond the live job grid (FAQs, related
// links, interview-prep panels, hero copy), so the page itself isn't
// worthless at zero jobs — it's just not worth a crawl budget/index slot
// *right now*. Below threshold, the page:
//   - still renders normally for a human visitor who lands on it directly
//     (e.g. from an internal link or a bookmark) — no dead end,
//   - gets `robots: { index: false, follow: true }` in generateMetadata
//     (same header-level noindex pattern lib/seo/seoMetrics.ts's
//     isStaleForIndexing()/isThinAndUnenriched() already use for job-detail
//     pages), and
//   - is dropped from its sitemap entry (see sitemap-skills.xml,
//     sitemap-locations.xml, sitemap-batches.xml) — a sitemap listing a
//     noindexed URL is a conflicting signal, the same reasoning Phase 2
//     item 7 already applied to /login and /register.
//
// A page clears the gate automatically the moment enough jobs are scraped
// for it, same self-healing property as isStaleForIndexing()/
// isThinAndUnenriched() clearing once their underlying condition resolves.
export const SKILL_MIN_JOBS = 5;
export const LOCATION_MIN_JOBS = 3;
export const BATCH_MIN_JOBS = 3;

export function belowHubThreshold(count: number, min: number): boolean {
    return count < min;
}
