import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://internshala.com"


class InternshalaScaper(BaseScraper):

    source_name = "internshala"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        keyword_str = " ".join(keywords[:3]) if keywords else "software engineer"
        location_str = locations[0] if locations else "India"

        jobs.extend(
            self._scrape_category("internships", keyword_str, location_str, max_pages, "internship")
        )
        jobs.extend(
            self._scrape_category("jobs", keyword_str, location_str, max_pages, "full-time")
        )

        self.log.info("Collected %d jobs from internshala", len(jobs))
        return jobs

    def _scrape_category(
        self,
        category: str,
        keyword: str,
        location: str,
        max_pages: int,
        job_type: str,
    ) -> List[Dict]:

        results = []

        for page_num in range(1, max_pages + 1):

            url = f"{BASE}/{category}/keywords-{quote(keyword)}"

            self.log.info("Internshala scrape: %s", url)

            try:
                html = self._render_page(url, page_num)
            except Exception as e:
                self.log.warning("Internshala render failed: %s", str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(f"internshala_{category}_{page_num}.html", "w", encoding="utf-8") as f:
                    f.write(html)

            soup = BeautifulSoup(html, "html.parser")

            selectors = [
                ".individual_internship",
                ".internship_meta",
                ".container-fluid.individual_internship",
                '[class*="internship_meta"]',
                ".internship-card",
            ]

            cards = []
            for selector in selectors:
                cards = soup.select(selector)
                if cards:
                    break

            self.log.info("Internshala found %d cards", len(cards))

            if not cards:
                continue

            for card in cards:
                try:
                    job = self._parse_card(card, job_type)
                    if job:
                        results.append(job)
                except Exception:
                    continue

            time.sleep(random.uniform(2, 4))

        return results

    def _render_page(self, url: str, page_number: int) -> str:

        if page_number > 1:
            url += f"/page-{page_number}"

        page = self.new_page()

        try:
            self.goto(page, url)
            page.wait_for_timeout(7000)

            for _ in range(3):
                page.mouse.wheel(0, 3000)
                page.wait_for_timeout(random.randint(1000, 2500))

            return page.content()
        finally:
            page.context.close()

    def _parse_card(self, card, job_type: str) -> Optional[Dict]:

        job = self._empty_job()

        title_el = (
            card.select_one(".profile h3")
            or card.select_one(".job-internship-name")
            or card.select_one("h3")
            or card.select_one("a")
        )

        company_el = (
            card.select_one(".company_name")
            or card.select_one(".company-name")
            or card.select_one("h4")
        )

        location_el = (
            card.select_one(".location_link")
            or card.select_one(".locations")
        )

        stipend_el = (
            card.select_one(".stipend")
            or card.select_one(".salary")
        )

        duration_el = (
            card.select_one(".other_detail_item")
            or card.select_one(".duration")
        )

        link_el = card.select_one("a")

        title = _clean(title_el.get_text(strip=True) if title_el else "")

        if not title:
            return None

        job["title"] = title
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")
        job["location"] = _clean(location_el.get_text(" ", strip=True) if location_el else "")
        job["stipend"] = _clean(stipend_el.get_text(strip=True) if stipend_el else "")
        job["salary"] = job["stipend"]
        job["duration"] = _clean(duration_el.get_text(" ", strip=True) if duration_el else "")
        job["type"] = job_type
        job["description"] = _clean(card.get_text(" ", strip=True))
        job["skills"] = []
        job["posted_date"] = ""
        job["deadline"] = ""
        job["is_remote"] = "remote" in job["location"].lower()

        href = link_el.get("href") if link_el else ""
        if href:
            if href.startswith("http"):
                job["apply_url"] = href
            else:
                job["apply_url"] = urljoin(BASE, href)
        else:
            job["apply_url"] = ""

        return job


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()