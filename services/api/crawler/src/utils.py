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

from config import (
    AWS_REGION,
    MAX_RETRIES,
    PROXY_LIST,
    RATE_LIMIT_DELAY,
    REQUEST_TIMEOUT,
    RETRY_BACKOFF,
    ROTATE_UA,
    S3_BUCKET,
    S3_PREFIX,
    USE_PROXY,
    USER_AGENTS,
)

import os

DATABASE_URL = os.getenv("DATABASE_URL")

PG_HOST = None
PG_DB = None
PG_USER = None
PG_PASSWORD = None
PG_PORT = "5432"

if DATABASE_URL:
    try:
        parsed = urlparse(DATABASE_URL)
        PG_HOST = parsed.hostname
        PG_DB = parsed.path.lstrip('/')
        PG_USER = parsed.username
        PG_PASSWORD = parsed.password
        PG_PORT = str(parsed.port or 5432)
    except Exception as e:
        log.error("Failed to parse DATABASE_URL: %s", e)
else:
    PG_HOST = os.getenv("PG_HOST")
    PG_DB = os.getenv("PG_DB")
    PG_USER = os.getenv("PG_USER")
    PG_PASSWORD = os.getenv("PG_PASSWORD")
    PG_PORT = os.getenv("PG_PORT", "5432")

if not all([PG_HOST, PG_DB, PG_USER, PG_PASSWORD]):
    raise ValueError(
        "PostgreSQL configuration missing. "
        "Please set DATABASE_URL or individual PG_HOST, PG_DB, PG_USER, and PG_PASSWORD environment variables.\n"
        f"DATABASE_URL: {'✓' if DATABASE_URL else '✗'}\n"
        f"PG_HOST: {'✓' if PG_HOST else '✗'}\n"
        f"PG_DB: {'✓' if PG_DB else '✗'}\n"
        f"PG_USER: {'✓' if PG_USER else '✗'}\n"
        f"PG_PASSWORD: {'✓' if PG_PASSWORD else '✗'}"
    )


def get_logger(name: str) -> logging.Logger:

    logger = logging.getLogger(name)

    if not logger.handlers:

        handler = logging.StreamHandler()

        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%SZ",
        )

        handler.setFormatter(formatter)

        logger.addHandler(handler)

        logger.setLevel(logging.INFO)

    return logger


log = get_logger("utils")
log.info(
    "PostgreSQL configured: %s:%s/%s",
    PG_HOST,
    PG_PORT,
    PG_DB,
)


def make_session(
    retries: int = MAX_RETRIES,
    backoff: float = RETRY_BACKOFF,
    extra_headers: Optional[Dict] = None,
) -> requests.Session:

    session = requests.Session()

    retry_strategy = Retry(
        total=retries,
        backoff_factor=backoff,
        status_forcelist=[
            429,
            500,
            502,
            503,
            504,
        ],
        allowed_methods=[
            "GET",
            "POST",
        ],
        raise_on_status=False,
    )

    adapter = HTTPAdapter(
        max_retries=retry_strategy
    )

    session.mount(
        "https://",
        adapter,
    )

    session.mount(
        "http://",
        adapter,
    )

    user_agent = (
        random.choice(USER_AGENTS)
        if ROTATE_UA
        else USER_AGENTS[0]
    )

    session.headers.update(
        {
            "User-Agent": user_agent,
            "Accept": (
                "text/html,"
                "application/xhtml+xml,"
                "application/json;q=0.9,"
                "*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "DNT": "1",
            **(extra_headers or {}),
        }
    )

    if (
        USE_PROXY
        and PROXY_LIST
        and PROXY_LIST[0]
    ):

        valid_proxies = [
            proxy
            for proxy in PROXY_LIST
            if proxy
        ]

        proxy = random.choice(
            valid_proxies
        )

        session.proxies = {
            "http": proxy,
            "https": proxy,
        }

        log.info(
            "Using proxy: %s",
            proxy,
        )

    return session


def retry(
    max_attempts: int = MAX_RETRIES,
    exceptions=(Exception,),
    backoff: float = RETRY_BACKOFF,
    logger: Optional[logging.Logger] = None,
):

    active_logger = logger or log

    def decorator(fn: Callable) -> Callable:

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):

            for attempt in range(
                1,
                max_attempts + 1,
            ):

                try:

                    return fn(
                        *args,
                        **kwargs,
                    )

                except exceptions as exc:

                    wait_time = (
                        backoff ** attempt
                        + random.uniform(0, 0.5)
                    )

                    if attempt == max_attempts:

                        active_logger.error(
                            (
                                "Function %s "
                                "failed after "
                                "%d attempts: %s"
                            ),
                            fn.__name__,
                            max_attempts,
                            exc,
                        )

                        raise

                    active_logger.warning(
                        (
                            "Attempt %d/%d "
                            "for %s failed "
                            "(%s). "
                            "Retrying in %.1fs"
                        ),
                        attempt,
                        max_attempts,
                        fn.__name__,
                        exc,
                        wait_time,
                    )

                    time.sleep(wait_time)

        return wrapper

    return decorator


class RateLimiter:

    def __init__(
        self,
        delay: float = RATE_LIMIT_DELAY,
    ):

        self.delay = delay

        self.last_request_time: Dict[
            str,
            float,
        ] = {}

    def wait(
        self,
        domain: str = "global",
    ) -> None:
        current_time = time.monotonic()

        previous_time = self.last_request_time.get(
            domain,
            0,
        )

        elapsed = current_time - previous_time

        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

        self.last_request_time[domain] = time.monotonic()


rate_limiter = RateLimiter()


def make_job_id(
    title: str,
    company: str,
    source: str,
    url: str,
) -> str:

    raw_value = (
        f"{title.lower().strip()}|"
        f"{company.lower().strip()}|"
        f"{source}|"
        f"{url}"
    )

    return hashlib.sha256(
        raw_value.encode()
    ).hexdigest()[:16]


def utcnow() -> str:

    return datetime.now(
        timezone.utc
    ).isoformat(
        timespec="seconds"
    )


_s3 = None


def get_s3():

    global _s3

    if _s3 is None:

        _s3 = boto3.client(
            "s3",
            region_name=AWS_REGION,
        )

    return _s3


def save_to_s3(
    jobs: List[Dict],
    source: str,
) -> str:

    date_prefix = utcnow()[:10]

    key = (
        f"{S3_PREFIX}"
        f"{source}/"
        f"{date_prefix}/"
        f"{utcnow()}.ndjson"
    )

    body = "\n".join(
        json.dumps(
            job,
            ensure_ascii=False,
        )
        for job in jobs
    )

    get_s3().put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=body.encode("utf-8"),
        ContentType="application/x-ndjson",
    )

    log.info(
        "Saved %d jobs from %s to s3://%s/%s",
        len(jobs),
        source,
        S3_BUCKET,
        key,
    )

    return key


_pg_conn = None


def get_pg_conn():

    global _pg_conn

    if _pg_conn is None:

        is_local_postgres = PG_HOST in {
            "postgres",
            "localhost",
            "127.0.0.1",
        }

        sslmode = (
            "disable"
            if is_local_postgres
            else "require"
        )

        log.info(
            "Connecting to PostgreSQL: %s:%s/%s | sslmode=%s",
            PG_HOST,
            PG_PORT,
            PG_DB,
            sslmode,
        )

        _pg_conn = psycopg2.connect(
            host=PG_HOST,
            database=PG_DB,
            user=PG_USER,
            password=PG_PASSWORD,
            port=PG_PORT,
            sslmode=sslmode,
            connect_timeout=10,
        )

        log.info(
            "PostgreSQL connection successful"
        )

    return _pg_conn


def upsert_jobs(
    jobs: List[Dict]
) -> int:

    if not jobs:
        return 0

    conn = get_pg_conn()

    cursor = conn.cursor()

    rows = []

    for job in jobs:

        posted_at = (
            job.get("posted_date")
            or job.get("posted_at")
            or None
        )

        deadline = job.get("deadline") or None

        rows.append(
            (
                job.get("id"),
                job.get("title"),
                job.get("company"),
                job.get("description"),
                job.get("apply_url"),
                job.get("source"),
                job.get("location"),
                job.get("salary"),
                job.get("stipend"),
                job.get("type"),
                posted_at,
                job.get("confidence_score", 0),
                job.get("confidence_label", "unverified"),
                job.get("apply_domain"),
                bool(job.get("is_official_domain", False)),
                job.get("domain_similarity", 0.0),
                deadline,
                bool(job.get("is_remote", False)),
                bool(job.get("is_government", False)),
                job.get("country") or None,
                job.get("department") or None,
                job.get("vacancies") or None,
                job.get("notification_number") or None,
            )
        )

    execute_batch(
        cursor,
        """
        INSERT INTO jobs (
            id,
            title,
            company,
            description,
            url,
            source,
            location,
            salary,
            stipend,
            type,
            posted_at,
            confidence_score,
            confidence_label,
            apply_domain,
            is_official_domain,
            domain_similarity,
            deadline,
            is_remote,
            is_government,
            country,
            department,
            vacancies,
            notification_number
        )
        VALUES (
            %s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,%s
        )
        ON CONFLICT (url)
        DO NOTHING
        """,
        rows,
    )

    conn.commit()

    written = len(rows)

    log.info(
        "Inserted %d jobs into PostgreSQL at %s:%s/%s",
        written,
        PG_HOST,
        PG_PORT,
        PG_DB,
    )

    return written


def job_exists(
    job_id: str
) -> bool:

    conn = get_pg_conn()

    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT 1
        FROM jobs
        WHERE id = %s
        LIMIT 1
        """,
        (job_id,),
    )

    return (
        cursor.fetchone()
        is not None
    )


def make_hackathon_id(
    title: str,
    organizer: str,
    source_url: str,
) -> str:

    raw_value = (
        f"{title.lower().strip()}|"
        f"{(organizer or '').lower().strip()}|"
        f"{source_url}"
    )

    return "hk_" + hashlib.sha256(
        raw_value.encode()
    ).hexdigest()[:16]


def make_hackathon_slug(
    title: str,
    hackathon_id: str,
) -> str:

    import re as _re

    slug = _re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    slug = _re.sub(r"-{2,}", "-", slug)

    if not slug:
        slug = "hackathon"

    return f"{slug}-{hackathon_id[-6:]}"


def upsert_hackathons(
    hackathons: List[Dict]
) -> int:

    if not hackathons:
        return 0

    conn = get_pg_conn()

    cursor = conn.cursor()

    rows = []

    for h in hackathons:

        rows.append(
            (
                h.get("id"),
                h.get("title"),
                h.get("slug"),
                h.get("organizer"),
                h.get("description"),
                h.get("participation_mode"),
                h.get("location"),
                h.get("country"),
                bool(h.get("is_global", False)),
                bool(h.get("is_student_friendly", False)),
                h.get("start_date"),
                h.get("end_date"),
                h.get("registration_deadline"),
                h.get("prize_pool_text"),
                h.get("prize_value_usd"),
                h.get("team_size_min"),
                h.get("team_size_max"),
                h.get("eligibility"),
                json.dumps(h.get("themes") or []),
                json.dumps(h.get("submission_requirements") or []),
                h.get("source"),
                json.dumps(h.get("sources") or [h.get("source")]),
                h.get("source_url"),
                h.get("apply_url"),
                h.get("image_url"),
                h.get("status", "upcoming"),
                h.get("quality_score", 0),
                h.get("trust_score", 0),
                h.get("source_hash"),
            )
        )

    execute_batch(
        cursor,
        """
        INSERT INTO hackathons (
            id, title, slug, organizer, description,
            participation_mode, location, country, is_global, is_student_friendly,
            start_date, end_date, registration_deadline,
            prize_pool_text, prize_value_usd,
            team_size_min, team_size_max,
            eligibility, themes, submission_requirements,
            source, sources, source_url, apply_url, image_url,
            status, quality_score, trust_score, source_hash,
            last_seen_at, updated_at
        )
        VALUES (
            %s,%s,%s,%s,%s,
            %s,%s,%s,%s,%s,
            %s,%s,%s,
            %s,%s,
            %s,%s,
            %s,%s,%s,
            %s,%s,%s,%s,%s,
            %s,%s,%s,%s,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (source_url) DO UPDATE SET
            title                  = EXCLUDED.title,
            description            = EXCLUDED.description,
            participation_mode     = EXCLUDED.participation_mode,
            location               = EXCLUDED.location,
            country                = EXCLUDED.country,
            is_global              = EXCLUDED.is_global,
            is_student_friendly    = EXCLUDED.is_student_friendly,
            start_date             = EXCLUDED.start_date,
            end_date               = EXCLUDED.end_date,
            registration_deadline  = EXCLUDED.registration_deadline,
            prize_pool_text        = EXCLUDED.prize_pool_text,
            prize_value_usd        = EXCLUDED.prize_value_usd,
            team_size_min          = EXCLUDED.team_size_min,
            team_size_max          = EXCLUDED.team_size_max,
            eligibility            = EXCLUDED.eligibility,
            themes                 = EXCLUDED.themes,
            submission_requirements = EXCLUDED.submission_requirements,
            apply_url              = EXCLUDED.apply_url,
            image_url              = COALESCE(EXCLUDED.image_url, hackathons.image_url),
            status                 = EXCLUDED.status,
            quality_score          = EXCLUDED.quality_score,
            trust_score            = EXCLUDED.trust_score,
            sources                = EXCLUDED.sources,
            is_active              = TRUE,
            last_seen_at           = CURRENT_TIMESTAMP,
            updated_at             = CURRENT_TIMESTAMP
        """,
        rows,
    )

    conn.commit()

    written = len(rows)

    log.info(
        "Upserted %d hackathons into PostgreSQL at %s:%s/%s",
        written,
        PG_HOST,
        PG_PORT,
        PG_DB,
    )

    return written


def deactivate_stale_hackathons(days: int = 3) -> int:

    conn = get_pg_conn()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE hackathons
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE last_seen_at < NOW() - INTERVAL '1 day' * %s
          AND is_active = TRUE
        """,
        (days,),
    )

    conn.commit()

    deactivated = cursor.rowcount

    log.info("Deactivated %d stale hackathons", deactivated)

    return deactivated


def safe_get(
    session: requests.Session,
    url: str,
    params: Optional[Dict] = None,
    headers: Optional[Dict] = None,
    timeout: int = REQUEST_TIMEOUT,
    domain_key: str = "global",
) -> Optional[requests.Response]:

    rate_limiter.wait(domain_key)

    try:

        response = session.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
        )

        response.raise_for_status()

        return response

    except requests.exceptions.RequestException as exc:

        log.warning(
            "HTTP error for %s: %s",
            url,
            exc,
        )

    return None


def safe_post(
    session: requests.Session,
    url: str,
    data: Optional[Dict] = None,
    json_data: Optional[Dict] = None,
    headers: Optional[Dict] = None,
    timeout: int = REQUEST_TIMEOUT,
    domain_key: str = "global",
) -> Optional[requests.Response]:

    rate_limiter.wait(domain_key)

    try:

        response = session.post(
            url,
            data=data,
            json=json_data,
            headers=headers,
            timeout=timeout,
        )

        response.raise_for_status()

        return response

    except requests.exceptions.RequestException as exc:

        log.warning(
            "POST error for %s: %s",
            url,
            exc,
        )

    return None