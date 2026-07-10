"""
We Work Remotely — https://weworkremotely.com

WWR publishes public RSS feeds per category (no auth, no JS rendering
needed). We parse those with BeautifulSoup's XML parser instead of driving
a browser against the HTML site, which is both faster and far less likely
to break on markup changes.
"""

import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from utils import safe_get


FEEDS = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
    "https://weworkremotely.com/categories/remote-product-jobs.rss",
    "https://weworkremotely.com/categories/remote-design-jobs.rss",
]

TITLE_RE = re.compile(r"^(?P<company>.+?):\s*(?P<title>.+)$")


class WeWorkRemotelyScraper(BaseScraper):

    source_name = "weworkremotely"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        for feed_url in FEEDS:

            resp = safe_get(
                self.session,
                feed_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                    "Accept": "application/rss+xml, application/xml",
                },
                domain_key="weworkremotely",
            )

            if resp is None:
                self.log.warning("WWR feed request failed: %s", feed_url)
                continue

            try:
                soup = BeautifulSoup(resp.content, "xml")
            except Exception:
                soup = BeautifulSoup(resp.content, "html.parser")

            items = soup.find_all("item")

            for item in items:
                try:
                    job = self._parse_item(item)
                    if job:
                        jobs.append(job)
                except Exception:
                    continue

        self.log.info("We Work Remotely collected %d jobs", len(jobs))
        return jobs

    def _parse_item(self, item) -> Optional[Dict]:
        raw_title = (item.find("title").text or "").strip() if item.find("title") else ""
        link = (item.find("link").text or "").strip() if item.find("link") else ""

        if not raw_title or not link:
            return None

        # WWR RSS titles are formatted "Company: Job Title".
        match = TITLE_RE.match(raw_title)
        company = match.group("company").strip() if match else "Unknown"
        title = match.group("title").strip() if match else raw_title

        description_tag = item.find("description")
        description = description_tag.text.strip() if description_tag else None

        pub_date_tag = item.find("pubDate")
        posted_date = pub_date_tag.text.strip() if pub_date_tag else None

        region_tag = item.find("region")
        region = region_tag.text.strip() if region_tag else "Worldwide"

        category_tag = item.find("category")
        job_type = "full-time"
        if category_tag and "intern" in category_tag.text.lower():
            job_type = "internship"

        return {
            "title": title,
            "company": company,
            "location": region,
            "type": job_type,
            "description": description,
            "apply_url": link,
            "posted_date": posted_date,
            "is_remote": True,
            "country": region,
        }
