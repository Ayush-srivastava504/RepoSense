# Changes this session

Implements INDEXING_RECOVERY_PLAN.md Phase C (JobPosting schema
completeness) and Phase D (breadcrumbs on hub pages).

## Phase C — JobPosting schema completeness

`apps/web/lib/structuredData.ts`, `jobPostingSchema()`:

- **`datePosted` fallback.** Was `job.posted_at` unconditionally, which
  produces an invalid/missing field when a source gives no posted date.
  Now falls back to `job.last_seen_at` ("when we first saw this
  listing" — honest, and a real date Google can anchor on), and the
  field is omitted entirely only if neither value exists (rather than
  emitting an empty string). `validThrough`'s own fallback calculation
  now derives from this same resolved `datePosted` instead of
  `job.posted_at` directly, so the two stay consistent.
- **`jobLocation` fallback.** Previously only set when `job.location`
  (a city string) existed; jobs with no city and not `is_remote` got no
  `jobLocation` at all — this matches GSC's "Missing field jobLocation"
  validation error. Added an `else` branch that emits a country-level
  `Place` (`addressCountry` only, no `addressLocality`) so every
  non-remote posting now has a valid `jobLocation`.

## Phase D — Breadcrumbs on hub pages

Investigation before writing anything: every hub/list page already had
`breadcrumbSchema()` + `<Breadcrumbs schema={crumbs}/>` wired in
(`/jobs`, `/internships`, `/remote-jobs`, `/government-jobs`,
`/japan-jobs`, `/japan-internships`, `/europe-jobs`, `/skills`,
`/skills/[skill]`, `/companies`, `/companies/[company]`, `/jobs-in`,
`/jobs-in/[city]`, `/tools/[tool]`, `/careers/[role]`,
`/resume-for/[role]`, `/tracker`, and the job/internship/remote/
government *detail* pages from the earlier session). PHASE_PLAN.md
Phase 3 item 4 and INDEXING_RECOVERY_PLAN.md's Phase D status ("not
started") were stale relative to the code.

What was actually still broken: seven of those pages
(`/skills/[skill]`, `/companies/[company]`, `/jobs-in/[city]`,
`/tools/[tool]`, `/careers/[role]`, `/resume-for/[role]`, `/tracker`)
rendered **both** the schema-driven `<Breadcrumbs>` component *and* a
second, hand-written `<nav>` breadcrumb trail directly in the page
JSX — a leftover from before `<Breadcrumbs>` existed that was never
removed when it was added. Every visitor to these pages was seeing the
breadcrumb trail twice. Removed the duplicate hand-written `<nav>`
block from all seven; `<Breadcrumbs>` (already schema-consistent by
construction, since it accepts the same `crumbs` object passed to
`breadcrumbSchema()`) is now the single source of the visible trail.
Verified no other page still has this duplicate, and that `Link` stays
used elsewhere in all seven files after the removal.

The `/jobs`, `/internships`, and other list pages named explicitly in
the plan were already clean (single `<Breadcrumbs>`, no duplicate) —
no change needed there.

## Status update

- Phase C: done this session.
- Phase D: done this session (wiring already existed; fixed the
  duplicate-breadcrumb bug that was the actual remaining defect).
- Phases A, B, E: still not started — unchanged by this session.
- PHASE_PLAN.md Phase 3 item 4 can be marked done as a side effect of
  this session's Phase D work.
