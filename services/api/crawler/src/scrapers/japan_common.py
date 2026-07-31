

import re
import time
from typing import Dict, List, Optional

import requests


HIMALAYAS_BROWSE_URL = "https://himalayas.app/jobs/api"
REMOTEOK_API_URL = "https://remoteok.com/api"

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
