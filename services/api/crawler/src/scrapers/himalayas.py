"""
Himalayas — https://himalayas.app

Himalayas exposes a public, unauthenticated JSON API
(https://himalayas.app/jobs/api) intended for exactly this kind of
aggregation. No browser required.
"""

from typing import Dict, List

from scrapers.base import BaseScraper
from utils import safe_get


API_URL = "https://himalayas.app/jobs/api"
PAGE_SIZE = 20


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

        offset = 0
        pages_fetched = 0

        while pages_fetched < max_pages:

            resp = safe_get(
                self.session,
                API_URL,
                params={"limit": PAGE_SIZE, "offset": offset},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept": "application/json",
                },
                domain_key="himalayas",
            )

            pages_fetched += 1

            if resp is None:
                self.log.warning("Himalayas request failed at offset %d", offset)
                break

            try:
                data = resp.json()
            except Exception as exc:
                self.log.warning("Himalayas JSON parse failed: %s", exc)
                break

            entries = data.get("jobs", [])

            if not entries:
                break

            for entry in entries:
                try:
                    job = self._parse_entry(entry)
                    if job:
                        jobs.append(job)
                except Exception:
                    continue

            offset += PAGE_SIZE

            if len(entries) < PAGE_SIZE:
                break

        self.log.info("Himalayas collected %d jobs", len(jobs))
        return jobs

    def _parse_entry(self, entry: Dict) -> Dict:
        title = (entry.get("title") or "").strip()
        company = ((entry.get("companyName")) or "").strip()

        if not title or not company:
            return None

        locations = entry.get("locationRestrictions") or []
        location = ", ".join(locations) if locations else "Worldwide"

        job_type_raw = (entry.get("employmentType") or "").lower()
        job_type = "internship" if "intern" in job_type_raw else (
            "contract" if "contract" in job_type_raw else "full-time"
        )

        min_salary = entry.get("minSalary")
        max_salary = entry.get("maxSalary")
        salary = None
        if min_salary and max_salary:
            salary = f"${min_salary:,} - ${max_salary:,}"

        apply_url = entry.get("applicationLink") or (
            f"https://himalayas.app/jobs/{entry.get('slug')}"
            if entry.get("slug") else None
        )

        return {
            "title": title,
            "company": company,
            "location": location,
            "type": job_type,
            "salary": salary,
            "description": entry.get("description"),
            "skills": entry.get("skills", []),
            "apply_url": apply_url,
            "posted_date": entry.get("pubDate"),
            "is_remote": True,
            "country": location,
        }
