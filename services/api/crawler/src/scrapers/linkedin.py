import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote

import asyncio
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

from scrapers.base import BaseScraper


BASE = "https://www.linkedin.com"


class LinkedInScraper(BaseScraper):

    source_name = "linkedin"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        keywords = keywords[:4]
        locations = locations[:3]

        for keyword in keywords:

            for location in locations:

                batch = self._search(
                    keyword,
                    location,
                    max_pages,
                )

                jobs.extend(batch)

                time.sleep(random.uniform(2, 4))

        self.log.info(
            "Collected %d jobs from linkedin",
            len(jobs),
        )

        return jobs

    def _search(
        self,
        keyword: str,
        location: str,
        max_pages: int,
    ) -> List[Dict]:

        results = []

        for page in range(max_pages):

            start = page * 25

            url = (
                f"{BASE}/jobs/search/"
                f"?keywords={quote(keyword)}"
                f"&location={quote(location)}"
                f"&start={start}"
            )

            self.log.info("LinkedIn scrape: %s", url)

            try:
                html = asyncio.get_event_loop().run_until_complete(
                    self._render_page(url)
                )
            except Exception as e:
                self.log.warning("LinkedIn render failed: %s", str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(
                    f"linkedin_debug_{page}.html",
                    "w",
                    encoding="utf-8",
                ) as f:
                    f.write(html)

            soup = BeautifulSoup(html, "html.parser")

            selectors = [
                ".base-card",
                ".job-search-card",
                ".jobs-search__results-list li",
                ".jobs-search-results__list-item",
                '[data-entity-urn]',
            ]

            cards = []

            for selector in selectors:
                cards = soup.select(selector)
                if cards:
                    break

            self.log.info("LinkedIn found %d cards", len(cards))

            if not cards:
                continue

            for card in cards:
                try:
                    job = self._parse_card(card)
                    if job:
                        results.append(job)
                except Exception:
                    continue

            time.sleep(random.uniform(2, 5))

        return results

    async def _render_page(self, url: str) -> str:

        async with async_playwright() as p:

            browser = await p.chromium.launch(headless=True)

            context = await browser.new_context(
                viewport={"width": 1400, "height": 900},
                user_agent=(
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/124.0.0.0 "
                    "Safari/537.36"
                ),
            )

            page = await context.new_page()

            await page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=60000,
            )

            await page.wait_for_timeout(7000)

            try:
                for _ in range(3):
                    await page.mouse.wheel(0, 4000)
                    await page.wait_for_timeout(random.randint(1500, 3000))
            except Exception:
                pass

            html = await page.content()

            await browser.close()

            return html

    def _parse_card(self, card) -> Optional[Dict]:

        job = self._empty_job()

        title_el = (
            card.select_one("h3.base-search-card__title")
            or card.select_one(".base-search-card__title")
            or card.select_one("h3")
            or card.select_one("a")
        )

        company_el = (
            card.select_one("h4.base-search-card__subtitle")
            or card.select_one(".base-search-card__subtitle")
            or card.select_one("h4")
        )

        location_el = card.select_one(".job-search-card__location")

        link_el = (
            card.select_one("a.base-card__full-link")
            or card.select_one("a")
        )

        time_el = card.select_one("time")

        title = _clean(title_el.get_text(strip=True) if title_el else "")

        if not title:
            return None

        job["title"] = title
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")
        job["location"] = _clean(location_el.get_text(strip=True) if location_el else "")
        job["posted_date"] = time_el.get("datetime", "") if time_el else ""
        job["description"] = _clean(card.get_text(" ", strip=True))
        job["skills"] = []
        job["salary"] = ""
        job["experience_required"] = ""
        job["type"] = _infer_type(job["title"])
        job["is_remote"] = "remote" in job["location"].lower()

        href = link_el.get("href") if link_el else ""

        if href:
            if href.startswith("http"):
                job["apply_url"] = href.split("?")[0]
            else:
                job["apply_url"] = BASE + href
        else:
            job["apply_url"] = ""

        return job


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _infer_type(title: str) -> str:
    title = (title or "").lower()
    if "intern" in title:
        return "internship"
    if "contract" in title or "freelance" in title:
        return "contract"
    return "full-time"