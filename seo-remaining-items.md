# SEO Plan — Remaining Items

Everything not yet done on the ML-engineer-article SEO plan, and why.

## Needs your job-listings data (Phase 7 — the real blocker)

- **Chart data pipeline** — skill frequency, experience distribution, salary
  ranges, tech clusters, location/work-arrangement distribution. Charts
  currently render nothing rather than fake numbers.
- **Sample size + "last updated" trust line** (e.g. "Based on 1,248 listings").
- **Sourcing every stat/claim** to a method + sample size.

## Real features, not SEO fixes

- **`interactiveFilters` / `dataExplorer`** — a live filtering UI backed by
  the jobs API. Faking it with static markup would be worse than omitting it.

## Needs a decision from you (not a coding task)

- **One-off vs. new content format** — is the ML article a prototype for
  more like it, or a one-off? Everything above hinges on this answer; if
  it's a one-off, most of this list disappears and the article just gets
  normalized back to a plain string body instead.
- **Topic-cluster linking** across ML/AI/MLOps/resume content — an
  editorial/content-strategy call, not something to infer from code.

## Needs live access not available here

- **Confirming the OG image actually resolves** (HTTP 200, correct
  content-type) — `intern-flow.in` isn't in the reachable domain list, so
  the image was generated and wired in, but the live URL wasn't hit to verify.

## Touches other pages / infra, out of scope for "the blog article"

- **Pagination SEO controls** on list pages (self-canonical URLs, no
  accidental indexing of filter combinations).
- **Indexation-health monitoring** (Search Console tracking of
  indexed/duplicate/soft-404 counts) — a GSC/monitoring setup, not code in
  this repo.

## Already correctly deferred, no action needed

- **hreflang** — intentionally gated off until real per-locale translations
  exist; enabling it now would be premature, not an oversight.
