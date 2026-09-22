# Bulk / fallback content-enrichment runner for jobs and internships (both
# live in the same `jobs` table, distinguished by the `type` column — no
# separate handling needed): job overview content (all of them, not just
# thin ones, in --bulk mode), and structured fields
# (allowed_degrees/required_skills/etc. — Phase B of
# INDEXING_RECOVERY_PLAN.md, same bulk backfill shape as the overview
# pass). The scheduled job-overview enrichment (job-content-enrichment.yml)
# runs this script.
# Groq-backed, with a
# deterministic template/rule-based fallback (see
# content_enrichment_service.py / structured_enrichment_service.py) so a
# run always produces usable content even without GROQ_API_KEY set or if
# a request fails, and can be pointed at the whole table instead of only
# thin/never-enriched rows.
#
# Company-profile enrichment (`--target companies`, company_profiles table) is
# fact-only: services/company_facts_service.py aggregates each company's own
# currently-listed jobs into a fact sheet and renders it. No Groq, no guessing,
# no per-row delay, so a whole run covers every company in seconds. It is NOT
# part of `--target all`; it has its own workflow (company-enrichment.yml).
#
# Job-content translation (`--target translations`, job_translations table) is
# locale-scoped per IMPLEMENTATION_PLAN.md §7: only already-enriched jobs that
# pass the same freshness/quality tier as the sitemap are translated, into a
# small starting locale list (TRANSLATION_LOCALES in
# services/translation_enrichment_service.py — es + pt as of Session 6). No
# rule-based fallback exists for translation, so this target always requires
# GROQ_API_KEY, with or without --no-fallback. Has its own workflow
# (job-translation-backfill.yml), like companies.
#
# Scheduled enrichment runs Groq-only (--no-fallback) with a runtime budget
# (--max-runtime-minutes) so it ends before the workflow's command_timeout:
#   job-content-enrichment.yml:      --target jobs --redo-fallback --no-fallback
#   phase-b-structured-backfill.yml: --target structured --bulk --no-fallback
# --no-fallback = Groq-written content only. --redo-fallback (jobs) also re-does rows an
# earlier run filled with the template fallback (enriched_model = 'template-fallback').
#
# Usage:
#   python scripts/enrich_all_content.py --target jobs --bulk --limit 500
#   python scripts/enrich_all_content.py --target jobs --redo-fallback --no-fallback --limit 60
#   python scripts/enrich_all_content.py --target structured --bulk --limit 500
#   python scripts/enrich_all_content.py --target structured --bulk --no-fallback --max-runtime-minutes 25 --limit 300
#   python scripts/enrich_all_content.py --target companies --limit 2000
#   python scripts/enrich_all_content.py --target all --bulk   # jobs + structured only

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
from configs.config import settings
from services.company_facts_service import (
    FACTS_MODEL, build_facts, build_keywords, render_overview,
)
from services.content_enrichment_service import ContentEnrichmentService, FALLBACK_MODEL
from services.structured_enrichment_service import (
    FALLBACK_MODEL as STRUCTURED_FALLBACK_MODEL,
    StructuredEnrichmentService,
)
from services.translation_enrichment_service import (
    TRANSLATION_LOCALES, TranslationEnrichmentService,
)

BATCH_LIMIT_DEFAULT = 200
REQUEST_DELAY_S = float(os.getenv('ENRICH_REQUEST_DELAY_S', '20'))
# Facts are cheap to recompute and go stale as listings turn over (internships
# expire in 10 days), so refresh nightly. 20h rather than 24h so a job that runs at
# the same clock time every day never sees yesterday's row as "not stale yet".
COMPANY_REFRESH_HOURS = 20
COMPANY_BATCH = 200


def _out_of_time(args) -> bool:
    """True once the --max-runtime-minutes budget is spent. Checked between rows, so a run
    ends cleanly instead of being killed by the workflow's command_timeout."""
    deadline = getattr(args, 'deadline', None)
    return deadline is not None and time.monotonic() >= deadline


async def enrich_jobs(pool, args) -> dict:
    service = ContentEnrichmentService()
    allow_fallback = not getattr(args, 'no_fallback', False)
    if getattr(args, 'redo_fallback', False):
        # Never-enriched rows plus rows an earlier run filled with the template
        # fallback, newest first.
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND (enriched_at IS NULL OR enriched_model = 'template-fallback') ORDER BY posted_at DESC NULLS LAST LIMIT $1"
    elif args.bulk:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true ORDER BY enriched_at NULLS FIRST, posted_at DESC NULLS LAST LIMIT $1"
    else:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND enriched_at IS NULL ORDER BY posted_at DESC NULLS LAST LIMIT $1"
    rows = await pool.fetch(query, args.limit)
    print(f'[enrich_all_content] jobs: {len(rows)} candidate(s) (bulk={args.bulk}, redo_fallback={getattr(args, "redo_fallback", False)}, ai_enabled={service.enabled}, fallback_allowed={allow_fallback})')
    enriched = ai = fallback = 0
    stopped_early = False
    for row in rows:
        if _out_of_time(args):
            stopped_early = True
            print(f'[enrich_all_content] jobs: --max-runtime-minutes budget spent after {enriched} row(s); stopping (remaining rows are picked up next run)')
            break
        result = await service.enrich(
            title=row['title'], company=row['company'], location=row['location'],
            description=row['description'], job_type=row['type'],
            allow_fallback=allow_fallback,
        )
        if result is None:
            await asyncio.sleep(REQUEST_DELAY_S)
            continue
        if not args.dry_run:
            await pool.execute(
                'UPDATE jobs SET enriched_overview = $2, enriched_keywords = $3, enriched_model = $4, enriched_at = now() WHERE id = $1',
                row['id'], result.overview, result.keywords, result.model,
            )
        enriched += 1
        if result.model == FALLBACK_MODEL:
            fallback += 1
        else:
            ai += 1
        await asyncio.sleep(REQUEST_DELAY_S)
    print(f'[enrich_all_content] jobs: enriched {enriched}/{len(rows)} (ai={ai}, fallback={fallback})')
    return {'attempted': len(rows), 'enriched': enriched, 'ai': ai, 'fallback': fallback, 'stopped_early': stopped_early}


_STRUCTURED_SET = """
    SET allowed_degrees = $2,
        allowed_courses = $3,
        allowed_specializations = $4,
        allowed_passout_years = $5,
        required_skills = $6,
        notes_highlights = $7,
        work_mode = $8,
        experience_min = $9,
        experience_max = $10,
        job_function = $11,
        structured_description = $12
"""
STRUCTURED_UPDATE_SQL = f"UPDATE jobs {_STRUCTURED_SET} WHERE id = $1"
# A rule-based fallback result has structured_description = NULL. In --bulk mode rows that
# already carry a Groq-written structured description are re-selected once the unstructured
# backlog is exhausted; if Groq fails for one of them the fallback must not overwrite it.
STRUCTURED_FALLBACK_UPDATE_SQL = f"UPDATE jobs {_STRUCTURED_SET} WHERE id = $1 AND structured_description IS NULL"


async def enrich_structured(pool, args) -> dict:
    # Phase B (INDEXING_RECOVERY_PLAN.md): structured_enrichment.py's crawl-time
    # pass only ever sees *this run's* newly-scraped jobs, capped at
    # STRUCTURED_ENRICHMENT_BATCH_LIMIT — identical shape to the
    # enriched_overview backlog problem enrich_jobs() above already backfills.
    # This is that same backfill, for the structured columns from
    # migrations/021_structured_job_details.sql instead.
    service = StructuredEnrichmentService()
    allow_fallback = not getattr(args, 'no_fallback', False)
    if args.bulk:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true ORDER BY structured_description IS NOT NULL, posted_at DESC NULLS LAST LIMIT $1"
    else:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND structured_description IS NULL ORDER BY posted_at DESC NULLS LAST LIMIT $1"
    rows = await pool.fetch(query, args.limit)
    print(f'[enrich_all_content] structured: {len(rows)} candidate(s) (bulk={args.bulk}, ai_enabled={service.enabled}, fallback_allowed={allow_fallback})')
    enriched = ai = fallback = 0
    stopped_early = False
    for row in rows:
        if _out_of_time(args):
            stopped_early = True
            print(f'[enrich_all_content] structured: --max-runtime-minutes budget spent after {enriched} row(s); stopping (remaining rows are picked up next run)')
            break
        result = await service.enrich(
            title=row['title'], company=row['company'], location=row['location'],
            description=row['description'], job_type=row['type'],
            allow_fallback=allow_fallback,
        )
        if result is None:
            await asyncio.sleep(REQUEST_DELAY_S)
            continue
        is_fallback = result.model == STRUCTURED_FALLBACK_MODEL
        if not args.dry_run:
            status = await pool.execute(
                STRUCTURED_FALLBACK_UPDATE_SQL if is_fallback else STRUCTURED_UPDATE_SQL,
                row['id'], result.allowed_degrees, result.allowed_courses,
                result.allowed_specializations, result.allowed_passout_years,
                result.required_skills, result.notes_highlights, result.work_mode,
                result.experience_min, result.experience_max, result.job_function,
                result.structured_description,
            )
            if is_fallback and status == 'UPDATE 0':
                # The row already had a Groq-written structured description; keep it.
                await asyncio.sleep(REQUEST_DELAY_S)
                continue
        enriched += 1
        if is_fallback:
            fallback += 1
        else:
            ai += 1
        await asyncio.sleep(REQUEST_DELAY_S)
    print(f'[enrich_all_content] structured: enriched {enriched}/{len(rows)} (ai={ai}, fallback={fallback})')
    return {'attempted': len(rows), 'enriched': enriched, 'ai': ai, 'fallback': fallback, 'stopped_early': stopped_early}


def _company_scope_sql() -> str:
    # Same "currently listed" definition the /companies page counts with
    # (routes/jobs.py: not past deadline, internships <10d, others <20d), so the
    # profile's numbers agree with the job list rendered next to it.
    from routes.jobs import _freshness_conditions
    return 'is_active = true AND ' + ' AND '.join(_freshness_conditions())


def company_candidates_sql() -> str:
    # One row per company, case-insensitive (routes/companies.py looks profiles up
    # with lower(company) = lower($1)). Busiest employers first; ordered so LIMIT
    # never falls back to arbitrary physical order.
    return f"""
    SELECT min(j.company) AS company, lower(j.company) AS ckey
    FROM jobs j
    LEFT JOIN company_profiles cp ON lower(cp.company) = lower(j.company)
    WHERE {_company_scope_sql()}
      AND j.company IS NOT NULL AND btrim(j.company) != ''
      AND (cp.company IS NULL OR cp.enriched_at IS NULL
           OR cp.enriched_at < now() - make_interval(hours => $2))
    GROUP BY lower(j.company)
    ORDER BY count(DISTINCT j.id) DESC, lower(j.company)
    LIMIT $1
"""


def company_fact_queries() -> dict[str, str]:
    scope = _company_scope_sql()
    key = "lower(company) = ANY($1::text[])"
    def group(expr: str, frm: str = 'jobs', where: str = '') -> str:
        extra = f' AND {where}' if where else ''
        return f"SELECT lower(company) AS ckey, {expr} AS v, count(*) AS n FROM {frm} WHERE {scope} AND {key}{extra} GROUP BY 1, 2"
    return {
        'base': f"""
    SELECT lower(company) AS ckey,
           count(*) AS active_listings,
           count(*) FILTER (WHERE type = 'internship') AS internships,
           count(*) FILTER (WHERE is_remote) AS remote_listings,
           count(*) FILTER (WHERE experience_min = 0) AS fresher_listings,
           min(experience_min) AS experience_min,
           max(experience_max) AS experience_max,
           count(*) FILTER (WHERE btrim(coalesce(stipend, '')) <> '') AS stipend_listings,
           count(*) FILTER (WHERE btrim(coalesce(salary, '')) <> '') AS salary_listings,
           (array_agg(apply_domain ORDER BY posted_at DESC NULLS LAST)
                FILTER (WHERE is_official_domain AND apply_domain IS NOT NULL))[1] AS official_domain,
           min(coalesce(posted_at, created_at)) AS first_listed,
           max(posted_at) AS latest_posted
    FROM jobs WHERE {scope} AND {key} GROUP BY lower(company)
""",
        'locations': group('btrim(location)', where="btrim(coalesce(location, '')) <> ''"),
        'work_modes': group('work_mode', where='work_mode IS NOT NULL'),
        'functions': group('btrim(job_function)', where="btrim(coalesce(job_function, '')) <> ''"),
        'skills': group('s', 'jobs, unnest(required_skills) AS s'),
        'courses': group('c', 'jobs, unnest(allowed_courses) AS c'),
    }


COMPANY_UPSERT_SQL = """
    INSERT INTO company_profiles
        (company, overview, keywords, facts, model, enriched_at, culture_summary, review_snippets)
    VALUES ($1, $2, $3, $4::jsonb, $5, now(), NULL, NULL)
    ON CONFLICT (company) DO UPDATE SET
        overview = EXCLUDED.overview,
        keywords = EXCLUDED.keywords,
        facts = EXCLUDED.facts,
        model = EXCLUDED.model,
        enriched_at = EXCLUDED.enriched_at,
        culture_summary = NULL,
        review_snippets = NULL
"""

# A different-case row for the same company would make the profile endpoint's
# lower() lookup ambiguous.
COMPANY_DEDUPE_SQL = "DELETE FROM company_profiles WHERE lower(company) = lower($1) AND company <> $1"


def _pairs(rows) -> dict:
    grouped: dict[str, list] = {}
    for r in rows:
        grouped.setdefault(r['ckey'], []).append((r['v'], r['n']))
    return grouped


async def enrich_companies(pool, args, today=None) -> dict:
    """Fact-only company profiles (no LLM). Writes a row for every candidate so it
    is not re-examined until stale; `overview` stays NULL when the company has too
    few facts to say anything worth showing."""
    candidates = await pool.fetch(company_candidates_sql(), args.limit, COMPANY_REFRESH_HOURS)
    print(f'[enrich_all_content] companies: {len(candidates)} candidate(s)')
    queries = company_fact_queries()
    written = with_overview = 0
    for i in range(0, len(candidates), COMPANY_BATCH):
        batch = candidates[i:i + COMPANY_BATCH]
        keys = [c['ckey'] for c in batch]
        base = {r['ckey']: dict(r) for r in await pool.fetch(queries['base'], keys)}
        extra = {name: _pairs(await pool.fetch(sql, keys))
                 for name, sql in queries.items() if name != 'base'}
        for c in batch:
            row = base.get(c['ckey'])
            if row is None:  # every job expired between the two queries
                continue
            facts = build_facts(
                row,
                locations=extra['locations'].get(c['ckey'], ()),
                work_modes=extra['work_modes'].get(c['ckey'], ()),
                functions=extra['functions'].get(c['ckey'], ()),
                skills=extra['skills'].get(c['ckey'], ()),
                courses=extra['courses'].get(c['ckey'], ()),
                as_of=today,
            )
            overview = render_overview(c['company'], facts)
            if not args.dry_run:
                await pool.execute(COMPANY_DEDUPE_SQL, c['company'])
                await pool.execute(
                    COMPANY_UPSERT_SQL, c['company'], overview,
                    build_keywords(c['company'], facts) if overview else [],
                    json.dumps(facts), FACTS_MODEL,
                )
            written += 1
            with_overview += 1 if overview else 0
    print(f'[enrich_all_content] companies: wrote {written}/{len(candidates)} ({with_overview} with an overview, {written - with_overview} below the fact threshold)')
    return {'attempted': len(candidates), 'enriched': written, 'with_overview': with_overview}


TRANSLATIONS_CANDIDATES_SQL = """
    WITH eligible AS (
        SELECT id, title, enriched_overview, structured_description, enriched_at, quality_score,
               COALESCE(posted_at, last_seen_at) AS ref_date
        FROM jobs
        WHERE is_active = true AND enriched_overview IS NOT NULL
    )
    SELECT e.id, e.title, e.enriched_overview, e.structured_description, l.locale
    FROM eligible e
    CROSS JOIN unnest($2::text[]) AS l(locale)
    LEFT JOIN job_translations jt ON jt.job_id = e.id AND jt.locale = l.locale
    WHERE e.ref_date IS NOT NULL
      AND (
            e.ref_date > now() - interval '30 days'
         OR (e.ref_date > now() - interval '90 days' AND COALESCE(e.quality_score, 0) >= 50)
         OR COALESCE(e.quality_score, 0) >= 75
      )
      AND (jt.job_id IS NULL OR (e.enriched_at IS NOT NULL AND e.enriched_at > jt.translated_at))
    ORDER BY e.ref_date DESC NULLS LAST
    LIMIT $1
"""
TRANSLATION_UPSERT_SQL = """
    INSERT INTO job_translations (job_id, locale, title, overview, structured_description, model, translated_at)
    VALUES ($1, $2, $3, $4, $5, $6, now())
    ON CONFLICT (job_id, locale) DO UPDATE SET
        title = EXCLUDED.title,
        overview = EXCLUDED.overview,
        structured_description = EXCLUDED.structured_description,
        model = EXCLUDED.model,
        translated_at = EXCLUDED.translated_at
"""


async def enrich_translations(pool, args) -> dict:
    """job_translations backfill (IMPLEMENTATION_PLAN.md §7). Candidates are
    (job, locale) pairs where the job is already content-enriched, passes the
    same freshness/quality tier lib/sitemapJobs.ts's isJobForSitemap uses
    (0-30d always; 31-90d needs quality_score>=50; 90d+ needs >=75 — same
    placeholder thresholds, not yet validated against production data), and
    either has no translation yet for that locale or the English content was
    re-enriched more recently than the existing translation.
    """
    service = TranslationEnrichmentService()
    rows = await pool.fetch(TRANSLATIONS_CANDIDATES_SQL, args.limit, TRANSLATION_LOCALES)
    print(f'[enrich_all_content] translations: {len(rows)} candidate(s) across locales={TRANSLATION_LOCALES} (ai_enabled={service.enabled})')
    translated = 0
    stopped_early = False
    for row in rows:
        if _out_of_time(args):
            stopped_early = True
            print(f'[enrich_all_content] translations: --max-runtime-minutes budget spent after {translated} row(s); stopping (remaining rows are picked up next run)')
            break
        result = await service.translate(
            title=row['title'], overview=row['enriched_overview'],
            structured_description=row['structured_description'], locale=row['locale'],
        )
        if result is None:
            await asyncio.sleep(REQUEST_DELAY_S)
            continue
        if not args.dry_run:
            await pool.execute(
                TRANSLATION_UPSERT_SQL, row['id'], row['locale'],
                result.title, result.overview, result.structured_description, result.model,
            )
        translated += 1
        await asyncio.sleep(REQUEST_DELAY_S)
    print(f'[enrich_all_content] translations: wrote {translated}/{len(rows)}')
    return {'attempted': len(rows), 'enriched': translated, 'stopped_early': stopped_early}


async def main():
    parser = argparse.ArgumentParser(description='Bulk/fallback content enrichment for jobs and internships')
    parser.add_argument('--target', choices=['jobs', 'structured', 'companies', 'translations', 'all'], default='all')
    parser.add_argument('--limit', type=int, default=BATCH_LIMIT_DEFAULT)
    parser.add_argument('--bulk', action='store_true', help='Process all rows, not just never-enriched ones — for backfilling every page at once')
    parser.add_argument('--no-fallback', action='store_true', help='jobs/structured: never store template or rule-based fallback content. Rows Groq cannot handle are left for the next run; exits 2 if GROQ_API_KEY is not set, and 3 if a target attempted rows but enriched none.')
    parser.add_argument('--max-runtime-minutes', type=float, default=0, help='jobs/structured: stop starting new rows once this many minutes have passed (0 = no limit). Keeps a run inside the workflow command_timeout; leave headroom for the row in flight (Groq 429 backoff can take several minutes).')
    parser.add_argument('--redo-fallback', action='store_true', help="jobs: also select rows previously filled by the template fallback (enriched_model = 'template-fallback'), newest first")
    parser.add_argument('--dry-run', action='store_true', help="Generate content and log it, but don't write to the DB")
    args = parser.parse_args()

    if not settings.DATABASE_URL:
        print('[enrich_all_content] DATABASE_URL not set — cannot run.')
        sys.exit(1)
    if args.target == 'translations' and not TranslationEnrichmentService().enabled:
        # Unlike jobs/structured, translation has no rule-based fallback — there is no
        # honest non-LLM substitute, so a missing key means "there is nothing this run
        # can do," not "fall back to something worse." Always refuse, not just under
        # --no-fallback.
        print('[enrich_all_content] --target translations requires GROQ_API_KEY, which is not set in this environment — refusing to run.')
        sys.exit(2)
    if args.no_fallback:
        # Without this, a container that cannot see GROQ_API_KEY would quietly write
        # fallback content for every row and the workflow would stay green.
        needs_ai = []
        if args.target in ('jobs', 'all') and not ContentEnrichmentService().enabled:
            needs_ai.append('jobs')
        if args.target in ('structured', 'all') and not StructuredEnrichmentService().enabled:
            needs_ai.append('structured')
        if needs_ai:
            print(f'[enrich_all_content] --no-fallback was given but GROQ_API_KEY is not set in this environment ({", ".join(needs_ai)}) — refusing to run.')
            sys.exit(2)
    args.deadline = time.monotonic() + args.max_runtime_minutes * 60 if args.max_runtime_minutes else None
    started = time.monotonic()

    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        summary = {}
        if args.target in ('jobs', 'all'):
            summary['jobs'] = await enrich_jobs(pool, args)
        if args.target in ('structured', 'all'):
            summary['structured'] = await enrich_structured(pool, args)
        if args.target == 'companies':
            summary['companies'] = await enrich_companies(pool, args)
        if args.target == 'translations':
            summary['translations'] = await enrich_translations(pool, args)
        print(f'[enrich_all_content] done in {(time.monotonic() - started) / 60:.1f} min:', json.dumps(summary))
        if args.no_fallback:
            stalled = [n for n in ('jobs', 'structured') if summary.get(n, {}).get('attempted') and not summary[n]['enriched'] and not summary[n].get('stopped_early')]
            if stalled:
                # Every candidate failed (Groq outage, or the same rows failing every night at the
                # head of the queue). Fail the run so it shows up instead of looking healthy.
                print(f'[enrich_all_content] {", ".join(stalled)}: rows were attempted but none could be enriched — failing the run.')
                sys.exit(3)
        if args.target == 'translations' and summary['translations']['attempted'] and not summary['translations']['enriched'] and not summary['translations']['stopped_early']:
            print('[enrich_all_content] translations: rows were attempted but none could be translated — failing the run.')
            sys.exit(3)
    finally:
        await pool.close()


if __name__ == '__main__':
    asyncio.run(main())
