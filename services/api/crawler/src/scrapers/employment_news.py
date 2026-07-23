import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from scrapers.base import BaseScraper


BASE = "https://employmentnews.gov.in"
LISTING_URL = f"{BASE}/newemp/AllJobs.aspx?k=All"

REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BACKOFF_SEC = 5

# Header keywords -> canonical field name. Matched case-insensitively
# against each header cell, so column order or minor label changes
# ("LAST DATE (DD/MM/YYYY)" vs "LAST DATE") don't break the mapping.
HEADER_FIELD_MAP = [
    ("issued date", "issued_date"),
    ("organisation", "organisation"),
    ("organization", "organisation"),
    ("post", "post"),
    ("method", "method"),
    ("last date", "last_date"),
]


class EmploymentNewsScraper(BaseScraper):

    source_name = "employment_news"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []
        session = requests.Session()
        session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/138.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        })

        try:
            html = self._fetch_with_retry(session, LISTING_URL)
            if html is None:
                return jobs

            soup = BeautifulSoup(html, "html.parser")
            table, field_index = self._find_jobs_table(soup)

            if table is None:
                self.log.warning(
                    "Employment News: no table with recognizable "
                    "headers found at %s — page markup may have "
                    "changed again",
                    LISTING_URL,
                )
                return jobs

            rows = table.find_all("tr")
            self.log.info(
                "Employment News url=%s matched table with %d rows, "
                "field_index=%r",
                LISTING_URL, len(rows), field_index,
            )

            for row in rows:
                try:
                    job = self._parse_row(row, field_index)
                except Exception as exc:
                    self.log.debug(
                        "Employment News row parse failed: %s", exc
                    )
                    continue
                if job:
                    jobs.append(job)

        finally:
            session.close()

        self.log.info("Employment News collected %d jobs", len(jobs))
        return jobs

    def _find_jobs_table(
        self, soup: BeautifulSoup
    ) -> Tuple[Optional[Tag], Dict[str, int]]:
        """Scan every <table> for a header row matching HEADER_FIELD_MAP
        keywords, instead of relying on a specific id/class that ASP.NET
        regenerates on every deploy."""

        for table in soup.find_all("table"):
            header_row = table.find("tr")
            if header_row is None:
                continue

            cells = header_row.find_all(["th", "td"])
            if not cells:
                continue

            field_index: Dict[str, int] = {}
            for idx, cell in enumerate(cells):
                text = _clean(cell.get_text(" ", strip=True)).lower()
                for keyword, field in HEADER_FIELD_MAP:
                    if keyword in text:
                        field_index[field] = idx
                        break

            # Require at least organisation + post to trust this table.
            if "organisation" in field_index and "post" in field_index:
                return table, field_index

        return None, {}

    def _fetch_with_retry(
        self, session: requests.Session, url: str,
    ) -> Optional[str]:

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                response = session.get(
                    url, timeout=REQUEST_TIMEOUT, allow_redirects=True,
                )
            except requests.RequestException as exc:
                self.log.warning(
                    "Employment News request failed (attempt %d/%d) "
                    "url=%s: %s", attempt, MAX_RETRIES, url, exc,
                )
                time.sleep(RETRY_BACKOFF_SEC * attempt)
                continue

            content_type = response.headers.get("content-type", "").lower()
            self.log.info(
                "Employment News HTTP %d (attempt %d/%d) "
                "content-type=%s bytes=%d url=%s",
                response.status_code, attempt, MAX_RETRIES,
                content_type, len(response.content), response.url,
            )

            if response.status_code == 200:
                body = response.text.strip()
                if not body:
                    self.log.warning(
                        "Employment News returned empty body url=%s", url
                    )
                    return None
                return body

            if response.status_code >= 500:
                self.log.warning(
                    "Employment News server error %d (attempt %d/%d) "
                    "url=%s body=%r",
                    response.status_code, attempt, MAX_RETRIES,
                    url, response.text[:300],
                )
                time.sleep(RETRY_BACKOFF_SEC * attempt)
                continue

            self.log.warning(
                "Employment News non-retryable HTTP %d url=%s body=%r",
                response.status_code, url, response.text[:300],
            )
            return None

        self.log.warning(
            "Employment News exhausted %d retries for url=%s — "
            "server likely down/500ing persistently",
            MAX_RETRIES, url,
        )
        return None

    def _parse_row(
        self, row: Tag, field_index: Dict[str, int]
    ) -> Optional[Dict]:

        cells = row.find_all("td")
        if not cells:
            return None  # header row or spacer row

        def cell_text(field: str) -> str:
            idx = field_index.get(field)
            if idx is None or idx >= len(cells):
                return ""
            return _clean(cells[idx].get_text(" ", strip=True))

        post = cell_text("post")
        organisation = cell_text("organisation")

        if not post or not organisation:
            return None  # blank trailing row, common in GridViews

        method = cell_text("method")
        issued_date_raw = cell_text("issued_date")
        last_date_raw = cell_text("last_date")

        # Site labels these MM/DD/YYYY and DD/MM/YYYY respectively.
        posted_date = _to_iso_date(issued_date_raw, day_first=False)
        deadline = _to_iso_date(last_date_raw, day_first=True)

        # Rows aren't individually linkable on this listing — point
        # applicants at the listing page itself rather than dropping
        # the job or fabricating a URL.
        link_tag = row.find("a", href=True)
        apply_url = (
            urljoin(LISTING_URL, link_tag["href"])
            if link_tag else LISTING_URL
        )

        description_parts = [organisation]
        if method:
            description_parts.append(f"Method of appointment: {method}")
        description = " | ".join(description_parts)

        return {
            "title": post,
            "company": organisation,
            "department": organisation,
            "vacancies": None,
            "notification_number": None,
            "location": "India",
            "type": _detect_job_type(post),
            "salary": "",
            "description": description,
            "skills": [],
            "apply_url": apply_url,
            "posted_date": posted_date,
            "deadline": deadline,
            "is_government": True,
            "is_remote": False,
            "country": "India",
            "category": method or None,
        }


def _detect_job_type(title: str) -> str:
    value = title.lower()
    if "intern" in value:
        return "internship"
    if "apprentice" in value:
        return "apprenticeship"
    if "contract" in value or "deputation" in value:
        return "contract"
    return "full-time"


def _to_iso_date(value: str, day_first: bool) -> str:
    if not value:
        return ""

    match = re.search(r"(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})", value)
    if not match:
        return ""

    a, b, year = match.groups()
    day, month = (a, b) if day_first else (b, a)

    if len(year) == 2:
        year = f"20{year}"

    try:
        parsed = datetime(year=int(year), month=int(month), day=int(day))
    except ValueError:
        return ""

    return parsed.strftime("%Y-%m-%d")


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()
