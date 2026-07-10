"""
Remote OK — https://remoteok.com

Remote OK exposes a public, unauthenticated JSON feed at /api which is far
more reliable than scraping their HTML (which is heavily JS-rendered). No
browser needed.
"""

from typing import Dict, List

from scrapers.base import BaseScraper
from utils import safe_get


API_URL = "https://remoteok.com/api"

# A handful of role keywords we care about (software/data/eng-adjacent).
# Remote OK's feed already covers "remote" implicitly — everything on the
# site is remote — so we just filter for relevance, not location.
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

        resp = safe_get(
            self.session,
            API_URL,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "application/json",
            },
            domain_key="remoteok",
        )

        if resp is None:
            self.log.warning("Remote OK request failed")
            return jobs

        try:
            data = resp.json()
        except Exception as exc:
            self.log.warning("Remote OK JSON parse failed: %s", exc)
            return jobs

        # First element is a legend/metadata blob, not a job.
        entries = [row for row in data if isinstance(row, dict) and row.get("id")]

        keyword_set = {k.lower() for k in keywords} if keywords else set()

        for entry in entries:
            try:
                job = self._parse_entry(entry, keyword_set)
                if job:
                    jobs.append(job)
            except Exception:
                continue

        self.log.info("Remote OK collected %d jobs", len(jobs))
        return jobs

    def _parse_entry(self, entry: Dict, keyword_set: set) -> Dict:
        title = (entry.get("position") or entry.get("title") or "").strip()
        company = (entry.get("company") or "").strip()

        if not title or not company:
            return None

        tags = [str(t).lower() for t in entry.get("tags", [])]

        if keyword_set:
            haystack = f"{title.lower()} {' '.join(tags)}"
            if not any(k in haystack for k in keyword_set):
                # Fall back to the broad default-tag relevance filter so we
                # don't drop everything when the caller's keywords are
                # unrelated to remote-friendly roles.
                if not (DEFAULT_TAGS & set(tags)) and not any(
                    t in title.lower() for t in DEFAULT_TAGS
                ):
                    return None

        salary_min = entry.get("salary_min")
        salary_max = entry.get("salary_max")
        salary = None
        if salary_min and salary_max:
            salary = f"${salary_min:,} - ${salary_max:,}"
        elif salary_min:
            salary = f"${salary_min:,}+"

        apply_url = entry.get("url") or (
            f"https://remoteok.com{entry.get('slug', '')}"
            if entry.get("slug") else None
        )

        return {
            "title": title,
            "company": company,
            "location": entry.get("location") or "Worldwide",
            "type": "full-time",
            "salary": salary,
            "description": entry.get("description"),
            "skills": tags,
            "apply_url": apply_url,
            "posted_date": entry.get("date"),
            "is_remote": True,
            "country": entry.get("location") or "Worldwide",
        }
