"""
Shared sourcing helpers for Japan-focused scrapers.

Used by both scrapers/japan_jobs.py (jobs, incl. Japan-remote) and
scrapers/japan_internships.py (internships, incl. Japan-remote internships).
Keeping the fetch/filter logic here means both scrapers stay in sync and a
fix only needs to happen once.

Himalayas was previously a third source here (browse endpoint, paged and
filtered client-side for Japan relevance) — REMOVED entirely, along with
the standalone scrapers/himalayas.py and scrapers/europe_himalayas.py,
because the Himalayas API was consistently returning 0 jobs. Jobicy and
Remote OK below are unaffected and remain the two active sources.
"""

import re
from typing import Dict, List, Optional

import requests


REMOTEOK_API_URL = "https://remoteok.com/api"
JOBICY_API_URL = "https://jobicy.com/api/v2/remote-jobs"

REQUEST_TIMEOUT = 30

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
