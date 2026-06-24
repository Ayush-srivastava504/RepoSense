# these one are not running because they ar efixed scraper some css issue means i am scraping by old way these website have change css now new css to check
import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from scrapers.base import BaseScraper


BASE = "https://www.glassdoor.co.in"


class GlassdoorScraper(BaseScraper):

    source_name = "glassdoor"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        keyword_queries = [
            "intern",
            "fresher",
            "graduate trainee",
            "junior software engineer",
        ]

        for keyword in keyword_queries[:4]:

            batch = self._search(
                keyword,
                max_pages,
            )

            jobs.extend(batch)

            time.sleep(
                random.uniform(2, 5)
            )

        self.log.info(
            "Collected %d jobs from glassdoor",
            len(jobs),
        )

        return jobs

    def _search(
        self,
        keyword: str,
        max_pages: int,
    ) -> List[Dict]:

        results = []

        for page in range(1, max_pages + 1):

            url = (
                f"{BASE}/Job/jobs.htm?"
                f"sc.keyword={quote(keyword)}"
                f"&p={page}"
            )

            self.log.info(
                "Glassdoor scrape: %s",
                url,
            )

            try:

                html = self._render_page(url)

            except Exception as e:

                self.log.warning(
                    "Glassdoor render failed: %s",
                    str(e),
                )

                continue

            # Write debug HTML only if SCRAPER_DEBUG is enabled
            if os.getenv("SCRAPER_DEBUG"):
                with open(
                    f"glassdoor_debug_{page}.html",
                    "w",
                    encoding="utf-8",
                ) as f:
                    f.write(html)

            soup = BeautifulSoup(
                html,
                "html.parser",
            )

            selectors = [
                "li.react-job-listing",
                "article[data-id]",
                ".JobsList_jobListItem__wjTHv",
                '[data-test="jobListing"]',
                '[class*="jobListing"]',
            ]

            cards = []

            for selector in selectors:

                cards = soup.select(selector)

                if cards:
                    break

            self.log.info(
                "Glassdoor found %d cards",
                len(cards),
            )

            if not cards:
                continue

            for card in cards:

                try:

                    job = self._parse_card(card)

                    if job:
                        results.append(job)

                except Exception:
                    continue

            time.sleep(
                random.uniform(2, 4)
            )

        return results

    def _render_page(
        self,
        url: str,
    ) -> str:

        with sync_playwright() as p:

            browser = p.chromium.launch(
                headless=True,
            )

            context = browser.new_context(
                viewport={
                    "width": 1400,
                    "height": 900,
                },
                user_agent=(
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/124.0.0.0 "
                    "Safari/537.36"
                ),
            )

            page = context.new_page()

            page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=60000,
            )

            page.wait_for_timeout(8000)

            try:

                for _ in range(4):

                    page.mouse.wheel(0, 4000)

                    page.wait_for_timeout(
                        random.randint(1200, 3000)
                    )

            except Exception:
                pass

            html = page.content()

            browser.close()

            return html

    def _parse_card(
        self,
        card,
    ) -> Optional[Dict]:

        job = self._empty_job()

        title_el = (
            card.select_one(
                '[data-test="job-title"]'
            )
            or card.select_one(
                ".JobCard_jobTitle__GLyJ1"
            )
            or card.select_one("h2")
            or card.select_one("a")
        )

        company_el = (
            card.select_one(
                '[data-test="employer-name"]'
            )
            or card.select_one(
                ".EmployerProfile_compactEmployerName__LE242"
            )
        )

        location_el = (
            card.select_one(
                '[data-test="location"]'
            )
            or card.select_one(
                ".JobCard_location__Ds1fM"
            )
        )

        salary_el = (
            card.select_one(
                '[data-test="detailSalary"]'
            )
            or card.select_one(
                ".JobCard_salaryEstimate__QpbTW"
            )
        )

        link_el = card.select_one("a")

        title = _clean(
            title_el.get_text(
                " ",
                strip=True,
            )
            if title_el
            else ""
        )

        if not title:
            return None

        job["title"] = title

        job["company"] = _clean(
            company_el.get_text(
                strip=True
            )
            if company_el
            else ""
        )

        job["location"] = _clean(
            location_el.get_text(
                strip=True
            )
            if location_el
            else ""
        )

        job["salary"] = _clean(
            salary_el.get_text(
                strip=True
            )
            if salary_el
            else ""
        )

        job["description"] = _clean(
            card.get_text(
                " ",
                strip=True,
            )
        )

        job["skills"] = []

        job["posted_date"] = ""

        job["type"] = (
            "internship"
            if "intern"
            in job["title"].lower()
            else "full-time"
        )

        job["is_remote"] = (
            "remote"
            in job["location"].lower()
        )

        href = (
            link_el.get("href")
            if link_el
            else ""
        )

        if href:

            if href.startswith("http"):

                job["apply_url"] = href

            else:

                job["apply_url"] = (
                    urljoin(BASE, href)
                )

        else:

            job["apply_url"] = ""

        return job


def _clean(s) -> str:

    return re.sub(
        r"\s+",
        " ",
        str(s or ""),
    ).strip()