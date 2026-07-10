"""
Remote OK — https://remoteok.com

Public unauthenticated JSON feed at /api.
No browser required.
"""

import re
from typing import Dict, List, Optional, Set

import requests

from scrapers.base import BaseScraper


API_URL = "https://remoteok.com/api"
REQUEST_TIMEOUT = 30

DEFAULT_TAGS = {
    "dev", "engineer", "developer", "software", "data", "backend",
    "frontend", "fullstack", "full stack", "python", "javascript",
    "react", "node", "java", "golang", "devops", "ml", "machine learning",
    "product", "design", "intern",
}


class RemoteOKScraper(BaseScraper):

    source_name = "remoteok"
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
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        })

        try:
            data = self._fetch(session)

            if data is None:
                return jobs

            if not isinstance(data, list):
                self.log.warning(
                    "Remote OK unexpected JSON root: %s",
                    type(data).__name__,
                )
                return jobs

            # First element is a legend/metadata blob, not a job.
            entries = [
                row for row in data
                if isinstance(row, dict) and row.get("id")
            ]

            self.log.info(
                "Remote OK payload had %d rows, %d look like jobs",
                len(data),
                len(entries),
            )

            keyword_set = {k.lower() for k in keywords} if keywords else set()

            for entry in entries:
                try:
                    job = self._parse_entry(entry, keyword_set)
                except Exception as exc:
                    self.log.debug("Remote OK parse failed: %s", exc)
                    continue

                if job:
                    jobs.append(job)

        finally:
            session.close()

        self.log.info("Remote OK collected %d jobs", len(jobs))
        return jobs

    def _fetch(self, session: requests.Session) -> Optional[list]:

        try:
            response = session.get(
                API_URL,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )

        except requests.RequestException as exc:
            self.log.warning("Remote OK request failed: %s", exc)
            return None

        content_type = response.headers.get("content-type", "").lower()

        self.log.info(
            "Remote OK HTTP %d content-type=%s bytes=%d url=%s",
            response.status_code,
            content_type,
            len(response.content),
            response.url,
        )

        if response.status_code == 403:
            self.log.warning(
                "Remote OK returned 403 — likely Cloudflare/bot block, "
                "body=%r",
                response.text[:300],
            )
            return None

        if response.status_code != 200:
            self.log.warning(
                "Remote OK HTTP failure %d body=%r",
                response.status_code,
                response.text[:300],
            )
            return None

        body = response.text.strip()

        if not body:
            self.log.warning("Remote OK returned empty response")
            return None

        if "application/json" not in content_type:
            self.log.warning(
                "Remote OK returned non-JSON content-type=%s body=%r",
                content_type,
                body[:300],
            )
            return None

        try:
            return response.json()
        except ValueError as exc:
            self.log.warning(
                "Remote OK JSON decode failed: %s body=%r",
                exc,
                body[:300],
            )
            return None

    def _parse_entry(
        self,
        entry: Dict,
        keyword_set: Set[str],
    ) -> Optional[Dict]:

        title = _clean(entry.get("position") or entry.get("title"))
        company = _clean(entry.get("company"))

        if not title or not company:
            return None

        tags = entry.get("tags")
        if not isinstance(tags, list):
            tags = []
        tags = [_clean(t).lower() for t in tags if _clean(t)]

        if keyword_set:
            haystack = f"{title.lower()} {' '.join(tags)}"
            if not any(k in haystack for k in keyword_set):
                if not (DEFAULT_TAGS & set(tags)) and not any(
                    t in title.lower() for t in DEFAULT_TAGS
                ):
                    return None

        salary_min = entry.get("salary_min")
        salary_max = entry.get("salary_max")
        salary = None
        try:
            if salary_min and salary_max:
                salary = f"${int(salary_min):,} - ${int(salary_max):,}"
            elif salary_min:
                salary = f"${int(salary_min):,}+"
        except (TypeError, ValueError):
            salary = None

        apply_url = _clean(entry.get("url"))
        if not apply_url:
            slug = _clean(entry.get("slug"))
            if slug:
                apply_url = f"https://remoteok.com{slug}"

        if not apply_url:
            return None

        location = _clean(entry.get("location")) or "Worldwide"

        return {
            "title": title,
            "company": company,
            "location": location,
            "type": "full-time",
            "salary": salary,
            "description": entry.get("description"),
            "skills": tags,
            "apply_url": apply_url,
            "posted_date": entry.get("date") or "",
            "is_remote": True,
            "country": location,
        }


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()