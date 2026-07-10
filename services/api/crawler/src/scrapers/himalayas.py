
import re
from typing import Dict, List, Optional

import requests

from scrapers.base import BaseScraper


API_URL = "https://himalayas.app/jobs/api"

PAGE_SIZE = 20
REQUEST_TIMEOUT = 30


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
                "Himalayas request failed offset=%d: %s",
                offset,
                exc,
            )

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

        if isinstance(restrictions, list):

            locations = [
                _clean(location)
                for location in restrictions
                if _clean(location)
            ]

        elif restrictions:

            locations = [
                _clean(restrictions)
            ]

        else:

            locations = []

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

            slug = _clean(
                entry.get("slug")
            )

            if slug:
                apply_url = (
                    f"https://himalayas.app/jobs/{slug}"
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
            "posted_date": entry.get("pubDate") or "",
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