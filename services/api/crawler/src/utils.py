import hashlib
import json
import logging
import random
import time
import functools
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional

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

# PostgreSQL Config – read from environment with sensible defaults for local dev
import os

# Default to localhost for local development; Docker services use the
# hostname "postgres" which is resolved only inside containers.
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_DB = os.getenv("PG_DB", "internship_db")
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASSWORD = os.getenv("PG_PASSWORD", "postgres")
PG_PORT = os.getenv("PG_PORT", "5432")

# Logger

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

# HTTP Session

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

# Retry Decorator

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

# Rate Limiter

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
        # BUG FIX: was corrupted with a stray SQL block; restored correct
        # elapsed-time calculation and sleep logic.
        current_time = time.monotonic()

        previous_time = self.last_request_time.get(
            domain,
            0,
        )

        elapsed = current_time - previous_time

        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)

        self.last_request_time[domain] = time.monotonic()


# Module-level singleton used by safe_get / safe_post
# BUG FIX: was missing entirely, causing NameError on every HTTP call.
rate_limiter = RateLimiter()


# Job ID helper
# BUG FIX: function signature was missing; only the body fragment survived.

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

# UTC Time

def utcnow() -> str:

    return datetime.now(
        timezone.utc
    ).isoformat(
        timespec="seconds"
    )

# S3 Backup

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

# PostgreSQL

_pg_conn = None


def get_pg_conn():

    global _pg_conn

    if _pg_conn is None:

        _pg_conn = psycopg2.connect(
            host=PG_HOST,
            database=PG_DB,
            user=PG_USER,
            password=PG_PASSWORD,
            port=PG_PORT,
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

        # Handle posted_date properly with fallback
        posted_at = (
            job.get("posted_date")
            or job.get("posted_at")
            or None
        )

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
            posted_at
        )
        VALUES (
            %s,%s,%s,%s,%s,
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
        "Inserted %d jobs into PostgreSQL",
        written,
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

# Safe GET

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

# Safe POST

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