import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://cutshort.io"

# Real category slugs — Cutshort no longer supports ?keyword query search,
# it uses pre-built SEO category pages instead.
CATEGORY_SLUGS = [
    "internship-jobs",
    "fullstack-developer-jobs",
    "backend-developer-jobs",
    "frontend-developer-jobs",
    "datascience-jobs",
    "devops-jobs",
]


class CutshortScraper(BaseScraper):

    source_name = "cutshort"
    uses_browser = True  # kept True for safety; site is SSR but JS-rendered fallback is cheap insurance

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        for slug in CATEGORY_SLUGS:
            try:
                html = self._render_category(slug)
            except Exception as e:
                self.log.warning("Cutshort render failed for %s: %s", slug, str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(f"cutshort_debug_{slug}.html", "w", encoding="utf-8") as f:
                    f.write(html)

            soup = BeautifulSoup(html, "html.parser")
            cards = self._find_cards(soup)
            self.log.info("Cutshort [%s] found %d cards", slug, len(cards))

            for card in cards:
                try:
                    job = self._parse_card(card)
                    if job:
                        jobs.append(job)
                except Exception:
                    continue

            time.sleep(random.uniform(2, 4))

        self.log.info("Collected %d jobs from cutshort", len(jobs))
        return jobs

    def _render_category(self, slug: str) -> str:
        url = f"{BASE}/jobs/{slug}"
        self.log.info("Cutshort scrape: %s", url)

        page = self.new_page()
        try:
            self.goto(page, url)
            page.wait_for_timeout(3000)
            # Site is mostly SSR — scroll a little in case of any lazy-loaded cards
            for _ in range(3):
                page.mouse.wheel(0, 3000)
                page.wait_for_timeout(random.randint(800, 1500))
            return page.content()
        finally:
            page.close()

    def _find_cards(self, soup: BeautifulSoup) -> List:
        """
        Cutshort's job cards are anchored around an <h2><a>title</a></h2>
        followed by an <h3><a>company</a></h3>. Rather than guess a wrapper
        class (which changes across redesigns), walk up from each h2 to its
        nearest container with both title and company present.
        """
        cards = []
        for h2 in soup.find_all("h2"):
            title_link = h2.find("a")
            if not title_link or not title_link.get_text(strip=True):
                continue
            container = h2.find_parent(["article", "div", "li"])
            # walk up further if the immediate parent doesn't also contain an h3
            hops = 0
            while container and not container.find("h3") and hops < 4:
                container = container.find_parent(["article", "div", "li"])
                hops += 1
            if container:
                cards.append(container)
        return cards

    def _parse_card(self, card) -> Optional[Dict]:
        job = self._empty_job()

        h2 = card.find("h2")
        title_link = h2.find("a") if h2 else None
        title = _clean(title_link.get_text(" ", strip=True)) if title_link else ""
        if not title:
            return None
        job["title"] = title

        h3 = card.find("h3")
        company_link = h3.find("a") if h3 else None
        job["company"] = _clean(company_link.get_text(strip=True)) if company_link else (
            _clean(h3.get_text(strip=True)) if h3 else ""
        )

        text_blob = _clean(card.get_text(" ", strip=True))

        loc_match = re.search(
            r"(Remote(?: only)?|Remote,\s*[\w\s]+|[\w\s]+\(?[\w\s]*\)?)\s*\d", text_blob
        )
        job["location"] = "Remote" if "remote" in text_blob.lower() else ""

        salary_match = re.search(r"₹[\d.,LK\s\-/yrmo]+", text_blob)
        job["salary"] = salary_match.group(0).strip() if salary_match else ""

        job["description"] = text_blob[:1000]
        job["skills"] = []
        job["type"] = "internship" if "intern" in title.lower() else "full-time"
        job["is_remote"] = "remote" in text_blob.lower()
        job["posted_date"] = ""

        href = title_link.get("href", "")
        job["apply_url"] = href if href.startswith("http") else urljoin(BASE, href)

        return job


def _clean(text) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()