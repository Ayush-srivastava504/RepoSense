# Changes this session

## Phase 2, item 7 — X-Robots-Tag audit for the rest of `(auth)`

Decided per-route (all in `apps/web/middleware.ts`'s `NOINDEX_PREFIXES`
comment block, and PHASE_PLAN.md item 7):

- **`/login`, `/register` — now noindexed.**
  - Added to `NOINDEX_PREFIXES` in `middleware.ts` (X-Robots-Tag: noindex, nofollow).
  - Added `Disallow: /login` and `Disallow: /register` to `public/robots.txt`,
    matching the existing `/dashboard` pattern (defense-in-depth).
  - Removed from `app/sitemap-static.xml/route.ts` — they'd been added there
    in the Aug SEO pass, but a sitemap entry for a noindexed URL is a
    conflicting signal to crawlers.
  - Reasoning: pure auth-flow pages, identical boilerplate every visit, no
    content anyone should land on from search.

- **`/resume(/builder)`, `/ats-checker`, `/cover-letter`, `/github`,
  `/linkedin` — left indexable, no change.**
  - `AuthGuard` admits guests via `ensureGuestSession()` — no real login
    required to view or use them, so "gated behind login" doesn't actually
    apply.
  - All five were deliberately added to `sitemap-static.xml` in the Aug SEO
    pass as tool landing pages; noindexing them now would contradict that
    earlier, intentional decision.

- **`/leetcode`, `/leetcode/[slug]` — left indexable, no change.**
  - Server components with their own `generateMetadata`, canonical URL, and
    JSON-LD — the clearest signal in the group that they're meant to be
    crawled.

Files touched: `apps/web/middleware.ts`, `apps/web/public/robots.txt`,
`apps/web/app/sitemap-static.xml/route.ts`, `PHASE_PLAN.md`.

## Removed the old duplicate filter bar from /jobs and /internships

`AdvancedJobFilters.tsx` (the new dropdown-popover bar: Location, Role,
Skills, Course, Source, Batch, Company) was rendering **below** the older
quick chip bar (`JobFilters.tsx`'s default export) rather than replacing
it, so both showed at once — the chip bar duplicated Location/Role with a
second, less capable control.

- `apps/web/app/jobs/page.tsx` and `apps/web/app/internships/page.tsx`:
  removed the `<JobFilters .../>` render. Kept the import for
  `parseLocationFilter` / `parseGroupFilter` / `parseWorkModeFilter`
  (still used to parse the URL params both pages read).
- `apps/web/app/components/JobFilters.tsx` itself is untouched — its
  `RoleFilter` named export is still used by `app/remote-jobs/page.tsx`,
  and the parse helpers above are still used everywhere.
- `apps/web/app/components/AdvancedJobFilters.tsx`: updated the stale
  header comment that described itself as rendering alongside the chip bar.

Only `/jobs` and `/internships` were touched — `/remote-jobs` doesn't use
the `<JobFilters>` chip bar (it uses the separate `RoleFilter` export), so
it wasn't part of this duplication and was left as-is.

## Phase 2 item 2's pagination follow-up — real server-side pagination

`/jobs` and `/internships` were fetching up to `limit=500` filtered jobs
in one call and slicing client-side to `JOBS_PER_PAGE` (12). Now they
request one page at a time and read the API's real `total`:

- `apps/web/lib/jobs.ts`: added `getJobsPage(options)`, returning
  `{ jobs, total }` (the backend already returns `total` from a
  `COUNT(*)` over the full filtered set — it just wasn't being read).
  `getJobs()` is unchanged; it's still what every hub/sitemap page that
  only wants the array uses.
- The real snag: the "India" location filter and "India first" ordering
  (`loc=all`) were computed client-side over the whole fetched array
  (`lib/jobPriority.ts`'s `isIndiaJob()`/`sortIndiaFirst()`), which can't
  work correctly against a single already-paged 12-row response. Ported
  both into SQL: `services/api/src/routes/jobs.py` gained `india_only`
  and `india_first` query params, doing the same null/blank/"india" →
  remote → "japan" → other precedence in a SQL `CASE` before
  `LIMIT`/`OFFSET`. `isIndiaJob`/`sortIndiaFirst` are kept — still used
  for the small, unpaginated featured-jobs list on both pages.
- `apps/web/app/jobs/page.tsx` and `apps/web/app/internships/page.tsx`:
  fetch by `offset = (page - 1) * JOBS_PER_PAGE`, `limit = JOBS_PER_PAGE`.
  If a requested `?page=` is past the real last page (stale bookmark /
  hand-edited URL), clamp and refetch once — the normal case stays a
  single request.

Files touched: `apps/web/lib/jobs.ts`, `apps/web/app/jobs/page.tsx`,
`apps/web/app/internships/page.tsx`, `services/api/src/routes/jobs.py`,
`PHASE_PLAN.md`.

**Not covered:** the facets endpoint (`GET /api/jobs/facets`) still isn't
scoped by `india_only`/`india_first` — it wasn't scoped by location
beyond Japan/remote before this change either, so the Skills/Course/etc.
dropdown counts on `loc=india` were already computed across all
locations, and still are. Out of scope for this pass since it wasn't
part of what item 2 flagged.
