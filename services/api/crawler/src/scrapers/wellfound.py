import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from scrapers.base import BaseScraper


class WellfoundScraper(BaseScraper):

    source_name = "wellfound"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        keyword_str = (
            " ".join(keywords[:3])
            if keywords
            else "software engineer intern"
        )

        for job_type in [
            "intern",
            "full-time",
        ]:

            for page in range(1, max_pages + 1):

                batch = self._fetch_page(
                    keyword_str,
                    locations,
                    job_type,
                    page,
                )

                if not batch:
                    break

                jobs.extend(batch)

                self.log.info(
                    "Wellfound %s page %d -> %d jobs",
                    job_type,
                    page,
                    len(batch),
                )

        self.log.info(
            "Collected %d jobs from wellfound",
            len(jobs),
        )

        return jobs

    def _fetch_page(
        self,
        keyword: str,
        locations: List[str],
        job_type: str,
        page: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        query = keyword.replace(" ", "%20")

        url = (
            f"https://wellfound.com/jobs?"
            f"q={query}&page={page}"
        )

        try:

            with sync_playwright() as p:

                browser = p.chromium.launch(
                    headless=True,
                )

                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 "
                        "(Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 "
                        "(KHTML, like Gecko) "
                        "Chrome/124.0.0.0 "
                        "Safari/537.36"
                    )
                )

                page_obj = context.new_page()

                page_obj.goto(
                    url,
                    timeout=60000,
                    wait_until="networkidle",
                )

                page_obj.wait_for_timeout(5000)

                html = page_obj.content()

                browser.close()

        except Exception as e:

            self.log.warning(
                "Wellfound browser error: %s",
                str(e),
            )

            return []

        with open(
            "wellfound_debug.html",
            "w",
            encoding="utf-8",
        ) as f:
            f.write(html)

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        selectors = [
            '[data-testid="StartupResult"]',
            '[data-testid="job-list-item"]',
            '.styles_component__UCLp3',
            '.styles_jobListItem__ivbD9',
            '.job-listing',
        ]

        cards = []

        for selector in selectors:

            cards = soup.select(selector)

            if cards:
                break

        self.log.info(
            "Wellfound found %d cards",
            len(cards),
        )

        for card in cards:

            try:

                title_el = (
                    card.select_one("h2")
                    or card.select_one("a")
                )

                company_el = (
                    card.select_one("h3")
                    or card.select_one("span")
                )

                link_el = card.select_one("a")

                title = (
                    title_el.get_text(strip=True)
                    if title_el
                    else ""
                )

                if not title:
                    continue

                job = self._empty_job()

                job["title"] = _clean(title)

                job["company"] = _clean(
                    company_el.get_text(strip=True)
                    if company_el
                    else ""
                )

                job["location"] = ""

                job["type"] = job_type

                job["salary"] = ""

                job["description"] = ""

                job["skills"] = []

                job["is_remote"] = False

                job["posted_date"] = ""

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
                            "https://wellfound.com"
                            + href
                        )

                else:

                    job["apply_url"] = ""

                jobs.append(job)

            except Exception:
                continue

        return jobs

    def _parse(
        self,
        raw: Dict,
    ) -> Optional[Dict]:

        return raw


def _clean(text: str) -> str:

    return re.sub(
        r"\s+",
        " ",
        text or "",
    ).strip()