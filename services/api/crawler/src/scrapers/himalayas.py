
import re
import time
from typing import Dict, List, Optional

import requests

from scrapers.base import BaseScraper


API_URL = "https://himalayas.app/jobs/api"
SEARCH_URL = "https://himalayas.app/jobs/api/search"

PAGE_SIZE = 20
REQUEST_TIMEOUT = 30

# Himalayas rate-limits aggressively (429). Retry a handful of times with
# backoff instead of giving up on the first page and returning 0 jobs.
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 3.0


class HimalayasScraper(BaseScraper):

    source_name = "himalayas"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []
        seen_urls = set()

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

        offset = 0

        try:
            for page_number in range(1, max_pages + 1):

                self.log.info(
                    "Himalayas page=%d offset=%d",
                    page_number,
                    offset,
                )

                data = self._fetch_page(
                    session=session,
                    offset=offset,
                )

                if data is None:
                    break

                entries = data.get("jobs")

                if not isinstance(entries, list):
                    self.log.warning(
                        "Himalayas invalid jobs field: %s",
                        type(entries).__name__,
                    )
                    break

                self.log.info(
                    "Himalayas page %d returned %d jobs",
                    page_number,
                    len(entries),
                )

                if not entries:
                    break

                for entry in entries:

                    if not isinstance(entry, dict):
                        continue

                    try:
                        job = self._parse_entry(entry)
                    except Exception as exc:
                        self.log.debug(
                            "Himalayas parse failed: %s",
                            exc,
                        )
                        continue

                    if not job:
                        continue

                    apply_url = job.get("apply_url")

                    if not apply_url:
                        continue

                    if apply_url in seen_urls:
                        continue

                    seen_urls.add(apply_url)
                    jobs.append(job)

                if len(entries) < PAGE_SIZE:
                    break

                offset += PAGE_SIZE

        finally:
            session.close()

        self.log.info(
            "Himalayas collected %d jobs",
            len(jobs),
        )

        return jobs

    def _fetch_page(
        self,
        session: requests.Session,
        offset: int,
    ) -> Optional[Dict]:

        response = None

        for attempt in range(1, MAX_RETRIES + 1):

            try:
                response = session.get(
                    API_URL,
                    params={
                        "limit": PAGE_SIZE,
                        "offset": offset,
                    },
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                )

            except requests.RequestException as exc:

                self.log.warning(
                    "Himalayas request failed offset=%d attempt=%d: %s",
                    offset,
                    attempt,
                    exc,
                )

                response = None

            if response is not None and response.status_code == 429:

                wait = RETRY_BACKOFF_SECONDS * attempt

                self.log.warning(
                    "Himalayas rate limited (429) offset=%d attempt=%d, "
                    "waiting %.1fs",
                    offset,
                    attempt,
                    wait,
                )

                time.sleep(wait)
                continue

            break

        if response is None:
            return None

        content_type = response.headers.get(
            "content-type",
            "",
        ).lower()

        self.log.info(
            "Himalayas HTTP %d content-type=%s bytes=%d url=%s",
            response.status_code,
            content_type,
            len(response.content),
            response.url,
        )

        if response.status_code != 200:

            self.log.warning(
                "Himalayas HTTP failure %d body=%r",
                response.status_code,
                response.text[:300],
            )

            return None

        body = response.text.strip()

        if not body:

            self.log.warning(
                "Himalayas returned empty response"
            )

            return None

        if "application/json" not in content_type:

            self.log.warning(
                "Himalayas returned non-JSON "
                "content-type=%s body=%r",
                content_type,
                body[:300],
            )

            return None

        try:
            data = response.json()

        except ValueError as exc:

            self.log.warning(
                "Himalayas JSON decode failed: %s body=%r",
                exc,
                body[:300],
            )

            return None

        if not isinstance(data, dict):

            self.log.warning(
                "Himalayas unexpected JSON root: %s",
                type(data).__name__,
            )

            return None

        return data

    def _parse_entry(
        self,
        entry: Dict,
    ) -> Optional[Dict]:

        title = _clean(
            entry.get("title")
        )

        company = _clean(
            entry.get("companyName")
        )

        if not title or not company:
            return None

        restrictions = entry.get(
            "locationRestrictions"
        )

        locations = _extract_location_names(restrictions)

        location = (
            ", ".join(locations)
            if locations
            else "Worldwide"
        )

        employment_type = _clean(
            entry.get("employmentType")
        ).lower()

        if "intern" in employment_type:

            job_type = "internship"

        elif "contract" in employment_type:

            job_type = "contract"

        elif "part" in employment_type:

            job_type = "part-time"

        else:

            job_type = "full-time"

        salary = self._format_salary(entry)

        apply_url = _clean(
            entry.get("applicationLink")
        )

        if not apply_url:

            # The API no longer returns a per-job "slug" field. Fall back
            # to the company slug + guid, which is still enough to build
            # a working link back to the listing on Himalayas.
            company_slug = _clean(
                entry.get("companySlug")
            )

            guid = _clean(
                entry.get("guid")
            )

            if company_slug and guid:
                apply_url = (
                    f"https://himalayas.app/companies/"
                    f"{company_slug}/jobs/{guid}"
                )

            elif company_slug:
                apply_url = (
                    f"https://himalayas.app/companies/{company_slug}"
                )

        if not apply_url:
            return None

        skills = entry.get("skills")

        if not isinstance(skills, list):
            skills = []

        skills = [
            _clean(skill)
            for skill in skills
            if _clean(skill)
        ]

        description = _clean(
            entry.get("description")
        )

        return {
            "title": title,
            "company": company,
            "location": location,
            "type": job_type,
            "salary": salary,
            "description": description[:5000],
            "skills": skills,
            "apply_url": apply_url,
            "posted_date": _to_iso_date(entry.get("pubDate")),
            "is_remote": True,
            "country": location,
        }

    def _format_salary(
        self,
        entry: Dict,
    ) -> str:

        min_salary = entry.get("minSalary")
        max_salary = entry.get("maxSalary")

        currency = _clean(
            entry.get("currency")
        ).upper()

        symbol = {
            "USD": "$",
            "EUR": "€",
            "GBP": "£",
            "INR": "₹",
        }.get(currency, "")

        try:
            if min_salary is not None and max_salary is not None:

                return (
                    f"{symbol}{int(min_salary):,} - "
                    f"{symbol}{int(max_salary):,}"
                )

            if min_salary is not None:

                return (
                    f"From {symbol}"
                    f"{int(min_salary):,}"
                )

            if max_salary is not None:

                return (
                    f"Up to {symbol}"
                    f"{int(max_salary):,}"
                )

        except (TypeError, ValueError):

            return ""

        return ""


def _clean(value) -> str:

    return re.sub(
        r"\s+",
        " ",
        str(value or ""),
    ).strip()


def _extract_location_names(restrictions) -> List[str]:
    """
    Himalayas now returns locationRestrictions as a list of objects
    like {"alpha2": "US", "name": "United States", "slug": "united-states"}
    instead of plain strings. Handle both shapes so this doesn't silently
    degrade if the API changes again.
    """

    if not restrictions:
        return []

    if isinstance(restrictions, dict):
        restrictions = [restrictions]

    if not isinstance(restrictions, list):
        return []

    names: List[str] = []

    for item in restrictions:

        if isinstance(item, dict):
            name = _clean(
                item.get("name")
                or item.get("alpha2")
                or item.get("slug")
            )

        else:
            name = _clean(item)

        if name:
            names.append(name)

    return names


def _to_iso_date(value) -> str:
    """
    pubDate/expiryDate are documented as Unix timestamps in milliseconds
    on the current API, but older payloads (and other callers) may still
    send an ISO 8601 string. Normalize both to an ISO date string so
    downstream normalization/sorting doesn't silently drop the job.
    """

    if not value:
        return ""

    if isinstance(value, (int, float)):

        try:
            from datetime import datetime, timezone

            # Treat large numbers as milliseconds, smaller as seconds.
            seconds = value / 1000 if value > 10_000_000_000 else value

            return datetime.fromtimestamp(
                seconds, tz=timezone.utc
            ).isoformat()

        except (ValueError, OSError, OverflowError):
            return ""

    return str(value)