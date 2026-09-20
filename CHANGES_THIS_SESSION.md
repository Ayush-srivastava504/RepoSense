# Changes this sessionn

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

## Phase B — scheduled the structured-field backfill

Full code audit this session found Phase A/C/D already done in code
(A had not been re-checked against code before; C/D above), and Phase B
half-done: `scripts/enrich_job_content.py` (overview backfill) already
runs on a schedule, but `scripts/enrich_all_content.py --target
structured --bulk` (structured-field backfill, migrations/021) existed
with no workflow calling it — a real gap, not just unverified.

Added `.github/workflows/phase-b-structured-backfill.yml`: daily SSH
into the EC2 box, `docker compose exec api python
scripts/enrich_all_content.py --target structured --bulk`, modeled on
the `EC2_HOST`/`EC2_SSH_KEY`/`ec2-user` pattern in
docs/DEPLOYMENT_GUIDE.md.

**Caveat:** `.github/workflows/` isn't present in this zip
(`create_zip.py` skips all dotfiles/dotdirs), so the real
`content-enrichment.yml` and `phase-f-priority-index.yml` this new file
is supposed to match weren't available to diff against — the new file
is a best-effort reconstruction of that pattern from
docs/DEPLOYMENT_GUIDE.md and the docker-compose service names, not a
verified match. Check its SSH-action version and exact invocation
against the real `content-enrichment.yml` before relying on it, and fix
the cron offset (currently a guess at 03:30 UTC to avoid overlapping
the overview job).

## Status update

- Phase A: done — re-verified in code this session (was previously
  unaudited, not actually "not started").
- Phase B: partially done — overview backfill already scheduled;
  structured backfill now scheduled as of this session (see above).
- Phase C: done this session.
- Phase D: done this session (wiring already existed; fixed the
  duplicate-breadcrumb bug that was the actual remaining defect).
- Phase E: still not started — correctly blocked on A/B and a
  2-3 week re-crawl window, unchanged by this session.
- Phase F: verified code-complete this session (was previously
  unaudited).
- PHASE_PLAN.md Phase 3 item 4 can be marked done as a side effect of
  this session's Phase D work.
