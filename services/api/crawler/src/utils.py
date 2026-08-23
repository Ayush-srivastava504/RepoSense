# Module: crawler/src/utils.py
# Defines class(es): RateLimiter
# Defines function(s): get_logger, make_session, retry, make_job_id, utcnow, get_s3, save_to_s3, get_pg_conn
#

import hashlib
import json
import logging
import random
import time
import functools
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional
from urllib.parse import urlparse
import boto3
import psycopg2
import requests
from botocore.exceptions import ClientError
from psycopg2.extras import execute_batch
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from config import AWS_REGION, MAX_RETRIES, PROXY_LIST, RATE_LIMIT_DELAY, REQUEST_TIMEOUT, RETRY_BACKOFF, ROTATE_UA, S3_BUCKET, S3_PREFIX, USE_PROXY, USER_AGENTS
import os
DATABASE_URL = os.getenv('DATABASE_URL')
PG_HOST = None
PG_DB = None
PG_USER = None
PG_PASSWORD = None
PG_PORT = '5432'
if DATABASE_URL:
    try:
        parsed = urlparse(DATABASE_URL)
        PG_HOST = parsed.hostname
        PG_DB = parsed.path.lstrip('/')
        PG_USER = parsed.username
        PG_PASSWORD = parsed.password
        PG_PORT = str(parsed.port or 5432)
    except Exception as e:
        log.error('Failed to parse DATABASE_URL: %s', e)
else:
    PG_HOST = os.getenv('PG_HOST')
    PG_DB = os.getenv('PG_DB')
    PG_USER = os.getenv('PG_USER')
    PG_PASSWORD = os.getenv('PG_PASSWORD')
    PG_PORT = os.getenv('PG_PORT', '5432')
if not all([PG_HOST, PG_DB, PG_USER, PG_PASSWORD]):
    raise ValueError(f'PostgreSQL configuration missing. Please set DATABASE_URL or individual PG_HOST, PG_DB, PG_USER, and PG_PASSWORD environment variables.\nDATABASE_URL: {("✓" if DATABASE_URL else "✗")}\nPG_HOST: {("✓" if PG_HOST else "✗")}\nPG_DB: {("✓" if PG_DB else "✗")}\nPG_USER: {("✓" if PG_USER else "✗")}\nPG_PASSWORD: {("✓" if PG_PASSWORD else "✗")}')

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s | %(levelname)-8s | %(name)s | %(message)s', datefmt='%Y-%m-%dT%H:%M:%SZ')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger
log = get_logger('utils')
log.info('PostgreSQL configured: %s:%s/%s', PG_HOST, PG_PORT, PG_DB)

def make_session(retries: int=MAX_RETRIES, backoff: float=RETRY_BACKOFF, extra_headers: Optional[Dict]=None) -> requests.Session:
    session = requests.Session()
    retry_strategy = Retry(total=retries, backoff_factor=backoff, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=['GET', 'POST'], raise_on_status=False)
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    user_agent = random.choice(USER_AGENTS) if ROTATE_UA else USER_AGENTS[0]
    session.headers.update({'User-Agent': user_agent, 'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive', 'DNT': '1', **(extra_headers or {})})
    if USE_PROXY and PROXY_LIST and PROXY_LIST[0]:
        valid_proxies = [proxy for proxy in PROXY_LIST if proxy]
        proxy = random.choice(valid_proxies)
        session.proxies = {'http': proxy, 'https': proxy}
        log.info('Using proxy: %s', proxy)
    return session

def retry(max_attempts: int=MAX_RETRIES, exceptions=(Exception,), backoff: float=RETRY_BACKOFF, logger: Optional[logging.Logger]=None):
    active_logger = logger or log

    def decorator(fn: Callable) -> Callable:

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as exc:
                    wait_time = backoff ** attempt + random.uniform(0, 0.5)
                    if attempt == max_attempts:
                        active_logger.error('Function %s failed after %d attempts: %s', fn.__name__, max_attempts, exc)
                        raise
                    active_logger.warning('Attempt %d/%d for %s failed (%s). Retrying in %.1fs', attempt, max_attempts, fn.__name__, exc, wait_time)
                    time.sleep(wait_time)
        return wrapper
    return decorator

class RateLimiter:

    def __init__(self, delay: float=RATE_LIMIT_DELAY):
        self.delay = delay
        self.last_request_time: Dict[str, float] = {}

    def wait(self, domain: str='global') -> None:
        current_time = time.monotonic()
        previous_time = self.last_request_time.get(domain, 0)
        elapsed = current_time - previous_time
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self.last_request_time[domain] = time.monotonic()
rate_limiter = RateLimiter()

def make_job_id(title: str, company: str, source: str, url: str) -> str:
    raw_value = f'{title.lower().strip()}|{company.lower().strip()}|{source}|{url}'
    return hashlib.sha256(raw_value.encode()).hexdigest()[:16]

def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')
_s3 = None

def get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client('s3', region_name=AWS_REGION)
    return _s3

def save_to_s3(jobs: List[Dict], source: str) -> str:
    date_prefix = utcnow()[:10]
    key = f'{S3_PREFIX}{source}/{date_prefix}/{utcnow()}.ndjson'
    body = '\n'.join((json.dumps(job, ensure_ascii=False) for job in jobs))
    get_s3().put_object(Bucket=S3_BUCKET, Key=key, Body=body.encode('utf-8'), ContentType='application/x-ndjson')
    log.info('Saved %d jobs from %s to s3://%s/%s', len(jobs), source, S3_BUCKET, key)
    return key
_pg_conn = None

def get_pg_conn():
    global _pg_conn
    if _pg_conn is None:
        is_local_postgres = PG_HOST in {'postgres', 'localhost', '127.0.0.1'}
        sslmode = 'disable' if is_local_postgres else 'require'
        log.info('Connecting to PostgreSQL: %s:%s/%s | sslmode=%s', PG_HOST, PG_PORT, PG_DB, sslmode)
        _pg_conn = psycopg2.connect(host=PG_HOST, database=PG_DB, user=PG_USER, password=PG_PASSWORD, port=PG_PORT, sslmode=sslmode, connect_timeout=10)
        log.info('PostgreSQL connection successful')
    return _pg_conn

def upsert_jobs(jobs: List[Dict]) -> int:
    if not jobs:
        return 0
    conn = get_pg_conn()
    cursor = conn.cursor()
    rows = []
    for job in jobs:
        posted_at = job.get('posted_date') or job.get('posted_at') or None
        deadline = job.get('deadline') or None
        rows.append((job.get('id'), job.get('title'), job.get('company'), job.get('description'), job.get('apply_url'), job.get('source'), job.get('location'), job.get('salary'), job.get('stipend'), job.get('type'), posted_at, job.get('confidence_score', 0), job.get('confidence_label', 'unverified'), job.get('apply_domain'), job.get('logo_domain'), bool(job.get('is_official_domain', False)), job.get('domain_similarity', 0.0), deadline, bool(job.get('is_remote', False)), bool(job.get('is_government', False)), job.get('country') or None, job.get('department') or None, job.get('vacancies') or None, job.get('notification_number') or None, job.get('job_group') or 'other'))
    execute_batch(cursor, "\n        INSERT INTO jobs (\n            id,\n            title,\n            company,\n            description,\n            url,\n            source,\n            location,\n            salary,\n            stipend,\n            type,\n            posted_at,\n            confidence_score,\n            confidence_label,\n            apply_domain,\n            logo_domain,\n            is_official_domain,\n            domain_similarity,\n            deadline,\n            is_remote,\n            is_government,\n            country,\n            department,\n            vacancies,\n            notification_number,\n            job_group,\n            last_seen_at\n        )\n        VALUES (\n            %s,%s,%s,%s,%s,\n            %s,%s,%s,%s,%s,%s,\n            %s,%s,%s,%s,%s,%s,\n            %s,%s,%s,%s,%s,%s,\n            %s,%s,\n            CURRENT_TIMESTAMP\n        )\n        ON CONFLICT (url)\n        DO UPDATE SET\n            -- Still-live listing seen again by the crawler: bring it back\n            -- from a stale de-rank/deactivation instead of leaving it\n            -- hidden forever. Content fields are left untouched so we\n            -- don't clobber any manual/enrichment edits made since the\n            -- first insert.\n            is_active     = TRUE,\n            last_seen_at  = CURRENT_TIMESTAMP,\n            job_group     = COALESCE(jobs.job_group, EXCLUDED.job_group)\n        ", rows)
    conn.commit()
    written = len(rows)
    log.info('Inserted %d jobs into PostgreSQL at %s:%s/%s', written, PG_HOST, PG_PORT, PG_DB)
    return written

def deactivate_stale_jobs(days: int=30) -> int:
    conn = get_pg_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("\n            UPDATE jobs\n            SET is_active = FALSE\n            WHERE COALESCE(last_seen_at, posted_at, created_at)\n                  < NOW() - INTERVAL '1 day' * %s\n              AND is_active = TRUE\n            ", (days,))
    except psycopg2.errors.UndefinedColumn:
        conn.rollback()
        cursor.execute("\n            UPDATE jobs\n            SET is_active = FALSE\n            WHERE COALESCE(last_seen_at, posted_at)\n                  < NOW() - INTERVAL '1 day' * %s\n              AND is_active = TRUE\n            ", (days,))
    conn.commit()
    deactivated = cursor.rowcount
    log.info('Deactivated %d stale jobs (older than %d days)', deactivated, days)
    return deactivated

def job_exists(job_id: str) -> bool:
    conn = get_pg_conn()
    cursor = conn.cursor()
    cursor.execute('\n        SELECT 1\n        FROM jobs\n        WHERE id = %s\n        LIMIT 1\n        ', (job_id,))
    return cursor.fetchone() is not None

def make_hackathon_id(title: str, organizer: str, source_url: str) -> str:
    raw_value = f'{title.lower().strip()}|{(organizer or "").lower().strip()}|{source_url}'
    return 'hk_' + hashlib.sha256(raw_value.encode()).hexdigest()[:16]

def make_hackathon_slug(title: str, hackathon_id: str) -> str:
    import re as _re
    slug = _re.sub('[^a-z0-9]+', '-', title.lower()).strip('-')
    slug = _re.sub('-{2,}', '-', slug)
    if not slug:
        slug = 'hackathon'
    return f'{slug}-{hackathon_id[-6:]}'

def upsert_hackathons(hackathons: List[Dict]) -> int:
    if not hackathons:
        return 0
    conn = get_pg_conn()
    cursor = conn.cursor()
    rows = []
    for h in hackathons:
        rows.append((h.get('id'), h.get('title'), h.get('slug'), h.get('organizer'), h.get('description'), h.get('participation_mode'), h.get('location'), h.get('country'), bool(h.get('is_global', False)), bool(h.get('is_student_friendly', False)), h.get('start_date'), h.get('end_date'), h.get('registration_deadline'), h.get('prize_pool_text'), h.get('prize_value_usd'), h.get('team_size_min'), h.get('team_size_max'), h.get('eligibility'), json.dumps(h.get('themes') or []), json.dumps(h.get('submission_requirements') or []), h.get('source'), json.dumps(h.get('sources') or [h.get('source')]), h.get('source_url'), h.get('apply_url'), h.get('image_url'), h.get('status', 'upcoming'), h.get('quality_score', 0), h.get('trust_score', 0), h.get('source_hash')))
    execute_batch(cursor, '\n        INSERT INTO hackathons (\n            id, title, slug, organizer, description,\n            participation_mode, location, country, is_global, is_student_friendly,\n            start_date, end_date, registration_deadline,\n            prize_pool_text, prize_value_usd,\n            team_size_min, team_size_max,\n            eligibility, themes, submission_requirements,\n            source, sources, source_url, apply_url, image_url,\n            status, quality_score, trust_score, source_hash,\n            last_seen_at, updated_at\n        )\n        VALUES (\n            %s,%s,%s,%s,%s,\n            %s,%s,%s,%s,%s,\n            %s,%s,%s,\n            %s,%s,\n            %s,%s,\n            %s,%s,%s,\n            %s,%s,%s,%s,%s,\n            %s,%s,%s,%s,\n            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP\n        )\n        ON CONFLICT (source_url) DO UPDATE SET\n            title                  = EXCLUDED.title,\n            description            = EXCLUDED.description,\n            participation_mode     = EXCLUDED.participation_mode,\n            location               = EXCLUDED.location,\n            country                = EXCLUDED.country,\n            is_global              = EXCLUDED.is_global,\n            is_student_friendly    = EXCLUDED.is_student_friendly,\n            start_date             = EXCLUDED.start_date,\n            end_date               = EXCLUDED.end_date,\n            registration_deadline  = EXCLUDED.registration_deadline,\n            prize_pool_text        = EXCLUDED.prize_pool_text,\n            prize_value_usd        = EXCLUDED.prize_value_usd,\n            team_size_min          = EXCLUDED.team_size_min,\n            team_size_max          = EXCLUDED.team_size_max,\n            eligibility            = EXCLUDED.eligibility,\n            themes                 = EXCLUDED.themes,\n            submission_requirements = EXCLUDED.submission_requirements,\n            apply_url              = EXCLUDED.apply_url,\n            image_url              = COALESCE(EXCLUDED.image_url, hackathons.image_url),\n            status                 = EXCLUDED.status,\n            quality_score          = EXCLUDED.quality_score,\n            trust_score            = EXCLUDED.trust_score,\n            sources                = EXCLUDED.sources,\n            is_active              = TRUE,\n            last_seen_at           = CURRENT_TIMESTAMP,\n            updated_at             = CURRENT_TIMESTAMP\n        ', rows)
    conn.commit()
    written = len(rows)
    log.info('Upserted %d hackathons into PostgreSQL at %s:%s/%s', written, PG_HOST, PG_PORT, PG_DB)
    return written

def deactivate_stale_hackathons(days: int=3) -> int:
    conn = get_pg_conn()
    cursor = conn.cursor()
    cursor.execute("\n        UPDATE hackathons\n        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP\n        WHERE last_seen_at < NOW() - INTERVAL '1 day' * %s\n          AND is_active = TRUE\n        ", (days,))
    conn.commit()
    deactivated = cursor.rowcount
    log.info('Deactivated %d stale hackathons', deactivated)
    return deactivated

def safe_get(session: requests.Session, url: str, params: Optional[Dict]=None, headers: Optional[Dict]=None, timeout: int=REQUEST_TIMEOUT, domain_key: str='global') -> Optional[requests.Response]:
    rate_limiter.wait(domain_key)
    try:
        response = session.get(url, params=params, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as exc:
        log.warning('HTTP error for %s: %s', url, exc)
    return None

def safe_post(session: requests.Session, url: str, data: Optional[Dict]=None, json_data: Optional[Dict]=None, headers: Optional[Dict]=None, timeout: int=REQUEST_TIMEOUT, domain_key: str='global') -> Optional[requests.Response]:
    rate_limiter.wait(domain_key)
    try:
        response = session.post(url, data=data, json=json_data, headers=headers, timeout=timeout)
        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as exc:
        log.warning('POST error for %s: %s', url, exc)
    return None
