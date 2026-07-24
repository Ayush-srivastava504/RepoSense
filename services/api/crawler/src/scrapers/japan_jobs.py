"""
Japan jobs — dedicated crawler for jobs and internships based in Japan
or explicitly open to applicants based in Japan.

Sources (both public, unauthenticated JSON, no browser required):
  1. Himalayas search API, filtered server-side with country=JP. This
     covers remote/hybrid roles that accept applicants based in Japan.
     https://himalayas.app/docs/remote-jobs-api
  2. Remote OK's public feed, filtered client-side for Japan-related
     tags/locations (e.g. "japan", "tokyo", "jp").

Jobs from this scraper are tagged country="Japan" so they show up under
the Japan filter regardless of which underlying source found them.
"""

import re
import time
from typing import Dict, List, Optional

import requests

from scrapers.base import BaseScraper


HIMALAYAS_SEARCH_URL = "https://himalayas.app/jobs/api/search"
REMOTEOK_API_URL = "https://remoteok.com/api"

REQUEST_TIMEOUT = 30
PAGE_SIZE = 20
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 3.0

JAPAN_HINTS = (
    "japan", "tokyo", "osaka", "kyoto", "yokohama", "nagoya",
    "fukuoka", "sapporo", "jp",
)


class JapanJobsScraper(BaseScraper):

    source_name = "japan_jobs"
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

        try:
            himalayas_jobs = self._scrape_himalayas(
                session=session,
                keywords=keywords,
                max_pages=max_pages,
            )

            for job in himalayas_jobs:
                url = job.get("apply_url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)

            remoteok_jobs = self._scrape_remoteok(session=session)

            for job in remoteok_jobs:
                url = job.get("apply_url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)

        finally:
            session.close()

        self.log.info(
            "Japan jobs collected %d jobs total",
            len(jobs),
        )

        return jobs

    # ------------------------------------------------------------------
    # Himalayas — server-side country=JP filter
    # ------------------------------------------------------------------

    def _scrape_himalayas(
        self,
        session: requests.Session,
        keywords: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        # A couple of broad, high-signal terms plus an unfiltered pass
        # keep this from missing postings that don't mention "job" or
        # "engineer" literally in the title.
        search_terms = (keywords[:2] if keywords else []) + [None]

        for term in search_terms:

            for page in range(1, max_pages + 1):

                data = self._fetch_himalayas_page(
                    session=session,
                    term=term,
                    page=page,
                )

                if data is None:
                    break

                entries = data.get("jobs")

                if not isinstance(entries, list) or not entries:
                    break

                for entry in entries:

                    if not isinstance(entry, dict):
                        continue

                    try:
                        job = self._parse_himalayas_entry(entry)
                    except Exception as exc:
                        self.log.debug(
                            "Japan/Himalayas parse failed: %s", exc
                        )
                        continue

                    if job:
                        jobs.append(job)

                if len(entries) < PAGE_SIZE:
                    break

        self.log.info(
            "Japan/Himalayas collected %d jobs",
            len(jobs),
        )

        return jobs

    def _fetch_himalayas_page(
        self,
        session: requests.Session,
        term: Optional[str],
        page: int,
    ) -> Optional[Dict]:

        params = {
            "country": "JP",
            "page": page,
        }

        if term:
            params["q"] = term

        response = None

        for attempt in range(1, MAX_RETRIES + 1):

            try:
                response = session.get(
                    HIMALAYAS_SEARCH_URL,
                    params=params,
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                )

            except requests.RequestException as exc:
                self.log.warning(
                    "Japan/Himalayas request failed q=%r page=%d: %s",
                    term, page, exc,
                )
                response = None

            if response is not None and response.status_code == 429:
                wait = RETRY_BACKOFF_SECONDS * attempt
                self.log.warning(
                    "Japan/Himalayas rate limited, waiting %.1fs", wait
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

    def _parse_himalayas_entry(self, entry: Dict) -> Optional[Dict]:

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
                    f"https://himalayas.app/companies/"
                    f"{company_slug}/jobs/{guid}"
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

    # ------------------------------------------------------------------
    # Remote OK — client-side filter for Japan-related listings
    # ------------------------------------------------------------------

    def _scrape_remoteok(
        self,
        session: requests.Session,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        try:
            response = session.get(
                REMOTEOK_API_URL,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
        except requests.RequestException as exc:
            self.log.warning("Japan/RemoteOK request failed: %s", exc)
            return jobs

        if response.status_code != 200:
            self.log.warning(
                "Japan/RemoteOK HTTP failure %d", response.status_code
            )
            return jobs

        try:
            data = response.json()
        except ValueError:
            return jobs

        if not isinstance(data, list):
            return jobs

        entries = [
            row for row in data
            if isinstance(row, dict) and row.get("id")
        ]

        for entry in entries:

            try:
                job = self._parse_remoteok_entry(entry)
            except Exception as exc:
                self.log.debug("Japan/RemoteOK parse failed: %s", exc)
                continue

            if job:
                jobs.append(job)

        self.log.info(
            "Japan/RemoteOK collected %d jobs",
            len(jobs),
        )

        return jobs

    def _parse_remoteok_entry(self, entry: Dict) -> Optional[Dict]:

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
            "description": entry.get("description"),
            "skills": [t for t in tags],
            "apply_url": apply_url,
            "posted_date": entry.get("date") or "",
            "is_remote": True,
            "country": "Japan",
        }


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()
