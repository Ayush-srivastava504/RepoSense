# Module: scripts/phase_f_priority_index_push.py
#
# Phase F — same-day priority indexing push. See INDEXING_RECOVERY_PLAN.md
# (Phases A-E) and PHASE_PLAN.md for the rest of the indexing-recovery work
# this sits on top of. Meant to run several times a day via
# .github/workflows/phase-f-priority-index.yml, same SSH-into-EC2 /
# docker-compose-run pattern as scripts/enrich_job_content.py.
#
# WHAT THIS DOES
# Each crawl run mixes a handful of genuinely high-value listings (a big/
# well-known company, a high confidence_score, posted today) in with the
# rest of the day's scrape. Phases A-E fixed the *pull* side (sitemap
# discipline, noindex for thin pages) — but a sitemap is still something
# Google has to decide to go re-fetch on its own schedule. This script is
# the *push* side: pick today's best jobs + internships and hand their
# URLs directly to the two indexing services that accept direct
# submission, same day, right after they're scraped:
#
#   - IndexNow (api.indexnow.org)      -> fans out to Bing, Yandex, Seznam,
#                                          Naver. No topic restriction.
#   - Google Indexing API (indexing.googleapis.com) -> Google has publicly
#     documented this API as being for pages with JobPosting or
#     BroadcastEvent structured data ONLY — not general "get my page
#     indexed faster" use. This site's job/internship detail pages already
#     emit JobPosting JSON-LD (apps/web/lib/structuredData.ts), which is
#     exactly why using it here is legitimate rather than a ToS workaround.
#     It is deliberately NOT used for hub pages, blog posts, or anything
#     else that isn't a JobPosting page. There is no equivalent "push"
#     API for Search Console itself — GSC's own UI only offers a manual,
#     one-URL-at-a-time "Request Indexing" button, which has no supported
#     bulk/API equivalent. The Indexing API is the real mechanism that
#     matches what people mean by "push to GSC" for a job board.
#
# SELECTION
# "High value" = the same signal routes/jobs.py already ranks by (a known/
# top-tier company via TOP_COMPANY_TIER, plus confidence_score), scoped to
# jobs.created_at::date = today (this is the crawler's first-ever-seen
# timestamp for a URL — see utils.py's upsert_jobs, which never overwrites
# created_at on a re-crawl, unlike last_seen_at). Thin-and-unenriched
# listings are excluded, matching the sitemap's own isThinAndUnenriched
# rule (INDEXING_RECOVERY_PLAN.md Phase A) — no point rapid-indexing a page
# that's flagged not worth indexing at all.
#
# Defaults: up to 60 non-internship jobs + up to 10 internships per run
# (see --job-cap/--internship-cap). Idempotent across runs via
# indexnow_submitted_at/google_indexing_submitted_at (migration 022) — a
# job already pushed is never re-selected, so running this every few hours
# tops up the day's push with whatever's newly cleared the bar since the
# last run instead of resubmitting the same URLs.
#
# USAGE
#   python scripts/phase_f_priority_index_push.py
#   python scripts/phase_f_priority_index_push.py --dry-run
#   python scripts/phase_f_priority_index_push.py --job-cap 50 --internship-cap 10
#   python scripts/phase_f_priority_index_push.py --skip-google
#
# ENV (see .env.example / configs/config.py):
#   INDEXNOW_KEY, INDEXNOW_HOST                    (both have working defaults)
#   GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON            (inline JSON, or a path to a
#                                                    service-account JSON file;
#                                                    empty = skip Google leg)
#   GOOGLE_INDEXING_DAILY_QUOT                   (default 180)

import argparse
import asyncio
import base64
import json
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
import httpx
from configs.config import settings
from routes.jobs import TOP_COMPANY_TIER  # single source of truth for "big company"

ROW_PREFIX = 'PRIORITY_PUSH_ROW'  # grepped by the GH Actions job-summary step
BASE_URL = os.environ.get('SITE_URL', 'https://intern-flow.in').rstrip('/')  # canonical = non-www; mirrors apps/web/lib/site.ts
GOOGLE_INDEXING_SCOPE = 'https://www.googleapis.com/auth/indexing'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_PUBLISH_URL = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
DEFAULT_JOB_CAP = 60
DEFAULT_INTERNSHIP_CAP = 10
REQUEST_DELAY_S = 0.3  # be polite to Google's per-URL publish endpoint


# --- URL building (ports apps/web/lib/slug.ts 1:1 so pushed URLs are the
# exact same canonical paths the site itself serves) -----------------------

def _slugify(value: str) -> str:
    import re
    value = re.sub(r'[^a-z0-9]+', '-', (value or '').lower())
    return value.strip('-')


def job_slug(job: Dict) -> str:
    parts = [_slugify(job.get('title') or ''), _slugify(job.get('company') or '')]
    location = job.get('location') or ''
    city = location.split(',')[0].strip() if location else ''
    if city:
        parts.append(_slugify(city))
    pay = job.get('salary') or job.get('stipend')
    if pay:
        parts.append(_slugify(pay))
    base = '-'.join(p for p in parts if p)
    max_base_length = 90
    if len(base) > max_base_length:
        base = base[:max_base_length].rstrip('-')
    return f"{base}-{job['id']}"


def canonical_category(job: Dict) -> str:
    if job.get('is_government'):
        return 'government-jobs'
    if job.get('type') == 'internship':
        return 'internships'
    if job.get('is_remote'):
        return 'remote-jobs'
    return 'jobs'


def canonical_url(job: Dict) -> str:
    return f"{BASE_URL}/{canonical_category(job)}/{job_slug(job)}"


# --- Selection --------------------------------------------------------------

_SELECT_COLUMNS = (
    "id, title, company, location, salary, stipend, type, is_remote, "
    "is_government, confidence_score"
)


async def _select(pool, *, only_internships: bool, top_companies: List[str], limit: int) -> List[Dict]:
    type_condition = "type = 'internship'" if only_internships else "type IS DISTINCT FROM 'internship'"
    query = f"""
        SELECT {_SELECT_COLUMNS},
               (lower(company) = ANY($1)) AS is_top_company
        FROM jobs
        WHERE is_active = TRUE
          AND indexnow_submitted_at IS NULL
          AND {type_condition}
          AND NOT (is_thin AND enriched_overview IS NULL)
          AND (deadline IS NULL OR deadline > now())
        ORDER BY
            (lower(company) = ANY($1)) DESC,
            COALESCE(confidence_score, 0) DESC,
            created_at DESC
        LIMIT $2
    """
    rows = await pool.fetch(query, top_companies, limit)
    return [dict(r) for r in rows]


async def select_priority_jobs(pool, job_cap: int, internship_cap: int) -> List[Dict]:
    top_companies = [c.lower() for c in TOP_COMPANY_TIER]
    jobs = await _select(pool, only_internships=False, top_companies=top_companies, limit=job_cap)
    internships = await _select(pool, only_internships=True, top_companies=top_companies, limit=internship_cap)
    return jobs + internships


# --- IndexNow ---------------------------------------------------------------

def submit_indexnow(client: httpx.Client, urls: List[str]) -> Tuple[bool, int, str]:
    if not urls:
        return True, 0, 'no urls'
    key_location = f"{BASE_URL}/{settings.INDEXNOW_KEY}.txt"
    payload = {
        'host': settings.INDEXNOW_HOST,
        'key': settings.INDEXNOW_KEY,
        'keyLocation': key_location,
        'urlList': urls,
    }
    try:
        resp = client.post(INDEXNOW_ENDPOINT, json=payload, timeout=20)
        ok = resp.status_code in (200, 202)
        return ok, resp.status_code, resp.text[:300]
    except httpx.HTTPError as exc:
        return False, 0, str(exc)


# --- Google Indexing API ----------------------------------------------------

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _build_signed_jwt(service_account_info: Dict, scope: str) -> str:
    # Self-contained RS256 JWT-bearer assertion — avoids pulling in
    # google-auth as a new dependency when cryptography (RSA signing) and
    # httpx (the token/publish HTTP calls) are already in requirements.txt.
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    now = int(time.time())
    header = {'alg': 'RS256', 'typ': 'JWT'}
    claims = {
        'iss': service_account_info['client_email'],
        'scope': scope,
        'aud': GOOGLE_TOKEN_URL,
        'iat': now,
        'exp': now + 3600,
    }
    signing_input = f"{_b64url(json.dumps(header).encode())}.{_b64url(json.dumps(claims).encode())}"
    private_key = serialization.load_pem_private_key(
        service_account_info['private_key'].encode(), password=None
    )
    signature = private_key.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    return f"{signing_input}.{_b64url(signature)}"


def _get_google_access_token(client: httpx.Client, service_account_info: Dict) -> Optional[str]:
    assertion = _build_signed_jwt(service_account_info, GOOGLE_INDEXING_SCOPE)
    try:
        resp = client.post(
            GOOGLE_TOKEN_URL,
            data={
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': assertion,
            },
            timeout=20,
        )
        if resp.status_code != 200:
            print(f'[phase_f] Google token exchange failed: HTTP {resp.status_code} {resp.text[:200]}')
            return None
        return resp.json().get('access_token')
    except httpx.HTTPError as exc:
        print(f'[phase_f] Google token exchange error: {exc}')
        return None


def submit_google_indexing(
    client: httpx.Client, access_token: str, url: str
) -> Tuple[bool, int, str]:
    try:
        resp = client.post(
            GOOGLE_PUBLISH_URL,
            json={'url': url, 'type': 'URL_UPDATED'},
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=20,
        )
        return resp.status_code == 200, resp.status_code, resp.text[:300]
    except httpx.HTTPError as exc:
        return False, 0, str(exc)


# --- DB writeback ------------------------------------------------------------

async def mark_submitted(pool, job_id: str, column: str) -> None:
    await pool.execute(f'UPDATE jobs SET {column} = now() WHERE id = $1', job_id)


async def log_submission(
    pool, *, job_id: str, url: str, target: str, is_top_company: bool,
    job_type: Optional[str], status_code: int, ok: bool, response_snippet: str,
) -> None:
    await pool.execute(
        """
        INSERT INTO priority_index_log
            (job_id, url, target, is_top_company, job_type, status_code, ok, response_snippet)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        """,
        job_id, url, target, is_top_company, job_type, status_code, ok, response_snippet,
    )


def _log_row(target: str, ok: bool, url: str, title: str, company: str) -> None:
    safe = lambda v: str(v or '').replace('|', '/').replace('\n', ' ').strip()
    status = 'OK' if ok else 'FAIL'
    print(f'{ROW_PREFIX}|{target}|{status}|{safe(url)}|{safe(title)} @ {safe(company)}')


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--job-cap', type=int, default=DEFAULT_JOB_CAP,
                         help='Max non-internship jobs to push this run (default 60; keep in the 50-60 range)')
    parser.add_argument('--internship-cap', type=int, default=DEFAULT_INTERNSHIP_CAP,
                         help='Max internships to push this run (default 10)')
    parser.add_argument('--skip-indexnow', action='store_true')
    parser.add_argument('--skip-google', action='store_true')
    parser.add_argument('--dry-run', action='store_true', help='Select and log only, no submissions or DB writes')
    args = parser.parse_args()

    if not settings.DATABASE_URL:
        print('[phase_f] DATABASE_URL not set — cannot run.')
        sys.exit(1)

    google_sa: Optional[Dict] = None
    if not args.skip_google and settings.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON:
        google_sa_value = settings.GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON.strip()

        try:
            if google_sa_value.startswith('{'):
                google_sa = json.loads(google_sa_value)
            else:
                google_sa_path = Path(google_sa_value)
                google_sa = json.loads(
                    google_sa_path.read_text(encoding='utf-8')
                )
        except (json.JSONDecodeError, OSError) as exc:
            print(
                f'[phase_f] Could not load Google service account: '
                f'{exc} — skipping Google leg.'
            )
    elif not args.skip_google:
        print('[phase_f] GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON not set — skipping Google leg (IndexNow only).')

    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        selected = await select_priority_jobs(pool, args.job_cap, args.internship_cap)
        job_count = sum(1 for j in selected if j.get('type') != 'internship')
        intern_count = sum(1 for j in selected if j.get('type') == 'internship')
        print(f'[phase_f] Selected {len(selected)} listing(s) for same-day push '
              f'({job_count} job(s), {intern_count} internship(s))')

        if not selected:
            print('[phase_f] Nothing new to push — done.')
            return

        for job in selected:
            job['url'] = canonical_url(job)

        if args.dry_run:
            for job in selected:
                _log_row('dry_run', True, job['url'], job['title'], job['company'])
            print('[phase_f] --dry-run set — no submissions made, no DB writes.')
            return

        with httpx.Client() as client:
            # --- IndexNow: one batch call for everything selected -----------
            if not args.skip_indexnow:
                urls = [j['url'] for j in selected]
                ok, status_code, snippet = submit_indexnow(client, urls)
                for job in selected:
                    _log_row('indexnow', ok, job['url'], job['title'], job['company'])
                    await log_submission(
                        pool, job_id=job['id'], url=job['url'], target='indexnow',
                        is_top_company=bool(job.get('is_top_company')), job_type=job.get('type'),
                        status_code=status_code, ok=ok, response_snippet=snippet,
                    )
                    if ok:
                        await mark_submitted(pool, job['id'], 'indexnow_submitted_at')
                print(f'[phase_f] IndexNow: HTTP {status_code} for batch of {len(urls)} — {snippet}')
            else:
                print('[phase_f] --skip-indexnow set — skipping IndexNow leg.')

            # --- Google Indexing API: one call per URL, quota-capped --------
            if google_sa is not None:
                access_token = _get_google_access_token(client, google_sa)
                if access_token is None:
                    print('[phase_f] Could not obtain a Google access token — skipping Google leg this run.')
                else:
                    quota = settings.GOOGLE_INDEXING_DAILY_QUOTA
                    pushed = 0
                    for job in selected:
                        if pushed >= quota:
                            print(f'[phase_f] Reached GOOGLE_INDEXING_DAILY_QUOTA ({quota}) — stopping Google leg for this run.')
                            break
                        ok, status_code, snippet = submit_google_indexing(client, access_token, job['url'])
                        _log_row('google_indexing', ok, job['url'], job['title'], job['company'])
                        await log_submission(
                            pool, job_id=job['id'], url=job['url'], target='google_indexing',
                            is_top_company=bool(job.get('is_top_company')), job_type=job.get('type'),
                            status_code=status_code, ok=ok, response_snippet=snippet,
                        )
                        if ok:
                            await mark_submitted(pool, job['id'], 'google_indexing_submitted_at')
                            pushed += 1
                        time.sleep(REQUEST_DELAY_S)
                    print(f'[phase_f] Google Indexing API: {pushed}/{len(selected)} succeeded this run.')

        print(f'[phase_f] Done — {len(selected)} listing(s) processed '
              f'({job_count} job(s), {intern_count} internship(s)).')
    finally:
        await pool.close()


if __name__ == '__main__':
    asyncio.run(main())