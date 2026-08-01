"""
Shared sourcing helpers for Japan-focused scrapers.

Used by both scrapers/japan_jobs.py (jobs, incl. Japan-remote) and
scrapers/japan_internships.py (internships, incl. Japan-remote internships).
Keeping the fetch/filter logic here means both scrapers stay in sync and a
fix only needs to happen once.

Why this fetches the *browse* endpoint instead of the search endpoint's
`country=` filter:

The Himalayas search API (/jobs/api/search) documents a `country` query
parameter, but we could not get consistent, correctly-filtered results back
from it in testing — repeated calls with country=JP / country=Japan kept
returning unfiltered, globally-mixed results instead of Japan-only jobs.
Rather than ship a crawler that silently returns wrong data if that
parameter is flaky/rate-limited/cached upstream, this pages through the
*browse* endpoint (/jobs/api), which is well-documented, paginates
predictably via offset/limit, and is already proven reliable by
scrapers/himalayas.py. Japan relevance is then decided client-side, the
same pattern already used for Remote OK below and in the original
japan_jobs.py. This costs more requests per run but is verifiable and
doesn't depend on trusting an unverified filter parameter.
"""

import re
import time
from typing import Dict, List, Optional

import requests


HIMALAYAS_BROWSE_URL = "https://himalayas.app/jobs/api"
REMOTEOK_API_URL = "https://remoteok.com/api"
JOBICY_API_URL = "https://jobicy.com/api/v2/remote-jobs"

REQUEST_TIMEOUT = 30
PAGE_SIZE = 20
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 3.0

# Himalayas caps the browse feed's usefulness for a single-country scan —
# scanning the whole feed (100k+ jobs) for every crawl run is wasteful, so
# cap how many pages we page through looking for Japan-relevant postings.
MAX_BROWSE_PAGES_HARD_CAP = 60

JAPAN_HINTS = (
    "japan", "tokyo", "osaka", "kyoto", "yokohama", "nagoya",
    "fukuoka", "sapporo", "kobe", "hiroshima", "sendai", "jp",
)


def fetch_jobicy_japan_entries(
    session: requests.Session,
    log,
) -> List[Dict]:
    """
    Jobicy's public v2 API (https://jobicy.com/jobs-rss-feed) is a
    documented, no-auth, self-serve endpoint with a real server-side
    `geo=japan` filter, confirmed against its own /api/v2/remote-jobs?get=locations
    taxonomy response (geoSlug "japan" -> geoID 3828). This is the primary
    Japan source: unlike Himalayas' search endpoint (whose country= filter
    we could not get to reliably return Japan-only results), Jobicy's geo
    filter is explicitly documented and its taxonomy is independently
    queryable, so it's trusted at face value rather than re-derived
    client-side.

    Fair use per Jobicy's published policy: no more than one poll per
    hour, keep the original jobicy.com source URL when displaying a
    listing, and don't republish to other job aggregators. The crawler's
    scheduling is outside this file's scope, but it must not be run more
    often than hourly for this source.
    """

    try:
        response = session.get(
            JOBICY_API_URL,
            params={"count": 100, "geo": "japan"},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        log.warning("Japan/Jobicy request failed: %s", exc)
        return []

    if response.status_code != 200:
        log.warning("Japan/Jobicy HTTP failure %d", response.status_code)
        return []

    try:
        data = response.json()
    except ValueError:
        return []

    if not isinstance(data, dict):
        return []

    jobs = data.get("jobs")

    if not isinstance(jobs, list):
        log.warning(
            "Japan/Jobicy invalid jobs field: %s",
            type(jobs).__name__,
        )
        return []

    return [row for row in jobs if isinstance(row, dict)]


def parse_jobicy_entry(entry: Dict) -> Optional[Dict]:

    title = _clean(entry.get("jobTitle"))
    company = _clean(entry.get("companyName"))

    if not title or not company:
        return None

    apply_url = _clean(entry.get("url"))

    if not apply_url:
        return None

    job_types = entry.get("jobType")
    job_types_text = (
        " ".join(_clean(t) for t in job_types).lower()
        if isinstance(job_types, list)
        else _clean(job_types).lower()
    )

    if "intern" in job_types_text or "intern" in title.lower():
        job_type = "internship"
    elif "contract" in job_types_text:
        job_type = "contract"
    elif "part" in job_types_text:
        job_type = "part-time"
    else:
        job_type = "full-time"

    industries = entry.get("jobIndustry")
    skills = (
        [_clean(i) for i in industries if _clean(i)]
        if isinstance(industries, list)
        else []
    )

    salary = ""
    salary_min = entry.get("salaryMin")
    salary_max = entry.get("salaryMax")
    salary_currency = _clean(entry.get("salaryCurrency"))

    if salary_min and salary_max:
        salary = f"{salary_currency} {salary_min}-{salary_max}".strip()
    elif salary_min:
        salary = f"{salary_currency} {salary_min}+".strip()

    description = _clean(entry.get("jobExcerpt") or entry.get("jobDescription"))

    return {
        "title": title,
        "company": company,
        "location": "Japan",
        "type": job_type,
        "salary": salary,
        "description": description[:5000],
        "skills": skills,
        "apply_url": apply_url,
        "posted_date": _clean(entry.get("pubDate")),
        "is_remote": True,
        "country": "Japan",
    }


def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/138.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
    })
    return session


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _is_japan_entry(entry: Dict) -> bool:
    """Client-side Japan relevance check against a raw Himalayas entry."""

    restrictions = entry.get("locationRestrictions")

    location_names: List[str] = []

    if isinstance(restrictions, list):
        for item in restrictions:
            if isinstance(item, dict):
                location_names.append(
                    _clean(
                        item.get("name")
                        or item.get("alpha2")
                        or item.get("slug")
                    )
                )
            else:
                location_names.append(_clean(item))

    categories = entry.get("categories")
    categories_text = (
        " ".join(_clean(c) for c in categories)
        if isinstance(categories, list)
        else ""
    )

    haystack = " ".join(
        [
            " ".join(location_names),
            categories_text,
            _clean(entry.get("title")),
        ]
    ).lower()

    return any(hint in haystack for hint in JAPAN_HINTS)


def fetch_himalayas_japan_entries(
    session: requests.Session,
    max_pages: int,
    log,
) -> List[Dict]:
    """
    Page through the Himalayas browse feed and return raw entries that look
    Japan-relevant (location, category, or title mentions Japan/a Japanese
    city). Caller is responsible for turning these into normalized job
    dicts and for splitting by employment type (job vs internship).
    """

    matched: List[Dict] = []

    offset = 0
    pages_to_scan = min(max(max_pages, 1) * 4, MAX_BROWSE_PAGES_HARD_CAP)
    page_number = 0

    for page_number in range(1, pages_to_scan + 1):

        data = _fetch_browse_page(session=session, offset=offset, log=log)

        if data is None:
            break

        entries = data.get("jobs")

        if not isinstance(entries, list):
            log.warning(
                "Japan/Himalayas invalid jobs field: %s",
                type(entries).__name__,
            )
            break

        if not entries:
            break

        for entry in entries:
            if isinstance(entry, dict) and _is_japan_entry(entry):
                matched.append(entry)

        if len(entries) < PAGE_SIZE:
            break

        offset += PAGE_SIZE

    log.info(
        "Japan/Himalayas scanned ~%d pages, matched %d Japan-relevant entries",
        page_number,
        len(matched),
    )

    return matched


def _fetch_browse_page(
    session: requests.Session,
    offset: int,
    log,
) -> Optional[Dict]:

    response = None

    for attempt in range(1, MAX_RETRIES + 1):

        try:
            response = session.get(
                HIMALAYAS_BROWSE_URL,
                params={"limit": PAGE_SIZE, "offset": offset},
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )

        except requests.RequestException as exc:
            log.warning(
                "Japan/Himalayas request failed offset=%d attempt=%d: %s",
                offset, attempt, exc,
            )
            response = None

        if response is not None and response.status_code in (429, 500, 502, 503, 504):
            wait = RETRY_BACKOFF_SECONDS * attempt
            log.warning(
                "Japan/Himalayas retryable status %s offset=%d attempt=%d, "
                "waiting %.1fs",
                response.status_code, offset, attempt, wait,
            )
            time.sleep(wait)
            continue

        break

    if response is None or response.status_code != 200:
        return None

    try:
        data = response.json()
    except ValueError:
        return None

    return data if isinstance(data, dict) else None


def parse_himalayas_entry(entry: Dict) -> Optional[Dict]:

    title = _clean(entry.get("title"))
    company = _clean(entry.get("companyName"))

    if not title or not company:
        return None

    apply_url = _clean(entry.get("applicationLink"))

    if not apply_url:
        company_slug = _clean(entry.get("companySlug"))
        guid = _clean(entry.get("guid"))
        if company_slug and guid:
            apply_url = (
                f"https://himalayas.app/companies/{company_slug}/jobs/{guid}"
            )

    if not apply_url:
        return None

    employment_type = _clean(entry.get("employmentType")).lower()

    if "intern" in employment_type:
        job_type = "internship"
    elif "contract" in employment_type:
        job_type = "contract"
    elif "part" in employment_type:
        job_type = "part-time"
    else:
        job_type = "full-time"

    skills = entry.get("skills")
    if not isinstance(skills, list):
        skills = []
    skills = [_clean(s) for s in skills if _clean(s)]

    description = _clean(entry.get("description"))

    return {
        "title": title,
        "company": company,
        "location": "Japan",
        "type": job_type,
        "salary": "",
        "description": description[:5000],
        "skills": skills,
        "apply_url": apply_url,
        "posted_date": "",
        "is_remote": True,
        "country": "Japan",
    }


def fetch_remoteok_japan_entries(
    session: requests.Session,
    log,
) -> List[Dict]:

    try:
        response = session.get(
            REMOTEOK_API_URL,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        log.warning("Japan/RemoteOK request failed: %s", exc)
        return []

    if response.status_code != 200:
        log.warning("Japan/RemoteOK HTTP failure %d", response.status_code)
        return []

    try:
        data = response.json()
    except ValueError:
        return []

    if not isinstance(data, list):
        return []

    return [row for row in data if isinstance(row, dict) and row.get("id")]


def parse_remoteok_entry(entry: Dict) -> Optional[Dict]:

    title = _clean(entry.get("position") or entry.get("title"))
    company = _clean(entry.get("company"))

    if not title or not company:
        return None

    tags = entry.get("tags")
    if not isinstance(tags, list):
        tags = []
    tags = [_clean(t).lower() for t in tags if _clean(t)]

    location = _clean(entry.get("location")).lower()

    haystack = f"{location} {' '.join(tags)} {title.lower()}"

    if not any(hint in haystack for hint in JAPAN_HINTS):
        return None

    apply_url = _clean(entry.get("url"))
    if not apply_url:
        slug = _clean(entry.get("slug"))
        if slug:
            apply_url = f"https://remoteok.com{slug}"

    if not apply_url:
        return None

    job_type = "internship" if "intern" in title.lower() else "full-time"

    return {
        "title": title,
        "company": company,
        "location": "Japan",
        "type": job_type,
        "salary": "",
        "description": _clean(entry.get("description")),
        "skills": tags,
        "apply_url": apply_url,
        "posted_date": entry.get("date") or "",
        "is_remote": True,
        "country": "Japan",
    }
