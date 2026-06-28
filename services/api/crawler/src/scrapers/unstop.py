import os
import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://unstop.com"


class UnstopScraper(BaseScraper):

    source_name = "unstop"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        jobs.extend(self._fetch_category("jobs", max_pages, "full-time"))
        jobs.extend(self._fetch_category("internships", max_pages, "internship"))
        jobs.extend(self._fetch_category("competitions", min(max_pages, 2), "hackathon"))

        self.log.info("Collected %d jobs from unstop", len(jobs))
        return jobs

    def _fetch_category(
        self,
        category: str,
        max_pages: int,
        job_type: str,
    ) -> List[Dict]:

        results = []

        for page_num in range(1, max_pages + 1):

            url = f"{BASE}/{category}?page={page_num}"

            self.log.info("Scraping Unstop: %s", url)

            try:
                html = self._render_page(url)
            except Exception as e:
                self.log.warning("Unstop render error: %s", str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(f"unstop_{category}_{page_num}.html", "w", encoding="utf-8") as f:
                    f.write(html)

            soup = BeautifulSoup(html, "html.parser")

            selectors = [
                '[class*="opportunity"]',
                '[class*="card"]',
                "article",
                ".card",
                ".opportunity-card",
            ]

            cards = []
            for selector in selectors:
                cards = soup.select(selector)
                if cards:
                    break

            self.log.info("Found %d cards on Unstop", len(cards))

            if not cards:
                continue

            for card in cards:
                try:
                    job = self._parse_card(card, job_type)
                    if job:
                        results.append(job)
                except Exception:
                    continue

        return results

    def _render_page(self, url: str) -> str:

        page = self.new_page()

        try:
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(5000)
            return page.content()
        finally:
            page.context.close()

    def _parse_card(self, card, job_type: str) -> Optional[Dict]:

        title_el = (
            card.select_one("h2")
            or card.select_one("h3")
            or card.select_one("a")
        )

        if not title_el:
            return None

        title = _clean(title_el.get_text(strip=True))

        if not title:
            return None

        company_el = (
            card.select_one('[class*="company"]')
            or card.select_one("h4")
            or card.select_one("span")
        )

        link_el = card.select_one("a")

        job = self._empty_job()

        job["title"] = title
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")
        job["location"] = ""
        job["type"] = job_type
        job["salary"] = ""
        job["stipend"] = ""
        job["duration"] = ""
        job["description"] = _clean(card.get_text(" ", strip=True))
        job["skills"] = []
        job["deadline"] = ""
        job["posted_date"] = ""
        job["is_remote"] = "remote" in job["description"].lower()

        href = link_el.get("href") if link_el else ""
        if href:
            if href.startswith("http"):
                job["apply_url"] = href
            else:
                job["apply_url"] = BASE + href
        else:
            job["apply_url"] = ""

        return job


def _clean(text) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()