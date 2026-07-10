"""
Remotive — https://remotive.com

Remotive publishes a public, unauthenticated JSON API
(https://remotive.com/api/remote-jobs) which is the documented, sanctioned
way to consume their listings — no HTML scraping or browser required.
"""

from typing import Dict, List

from scrapers.base import BaseScraper
from utils import safe_get


API_URL = "https://remotive.com/api/remote-jobs"


class RemotiveScraper(BaseScraper):

    source_name = "remotive"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        # Remotive lets us pre-filter by search term server-side, which
        # keeps the payload small and relevant.
        search_terms = keywords[:3] if keywords else ["software engineer"]

        seen_urls = set()

        for term in search_terms:

            resp = safe_get(
                self.session,
                API_URL,
                params={"search": term},
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept": "application/json",
                },
                domain_key="remotive",
            )

            if resp is None:
                self.log.warning("Remotive request failed for '%s'", term)
                continue

            try:
                data = resp.json()
            except Exception as exc:
                self.log.warning("Remotive JSON parse failed: %s", exc)
                continue

            for entry in data.get("jobs", []):
                url = entry.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)

                try:
                    job = self._parse_entry(entry)
                    if job:
                        jobs.append(job)
                except Exception:
                    continue

        self.log.info("Remotive collected %d jobs", len(jobs))
        return jobs

    def _parse_entry(self, entry: Dict) -> Dict:
        title = (entry.get("title") or "").strip()
        company = (entry.get("company_name") or "").strip()

        if not title or not company:
            return None

        job_type_raw = (entry.get("job_type") or "").lower()
        job_type = "internship" if "intern" in job_type_raw else (
            "contract" if "contract" in job_type_raw or "freelance" in job_type_raw
            else "full-time"
        )

        return {
            "title": title,
            "company": company,
            "location": entry.get("candidate_required_location") or "Worldwide",
            "type": job_type,
            "salary": entry.get("salary") or None,
            "description": entry.get("description"),
            "skills": entry.get("tags", []),
            "apply_url": entry.get("url"),
            "posted_date": entry.get("publication_date"),
            "is_remote": True,
            "country": entry.get("candidate_required_location") or "Worldwide",
        }
