import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://cutshort.io"

CATEGORY_SLUGS = [
    "internship-jobs",
    "fullstack-developer-jobs",
    "backend-developer-jobs",
    "frontend-developer-jobs",
    "datascience-jobs",
    "devops-jobs",
]

REQUEST_TIMEOUT = 20


class CutshortScraper(BaseScraper):

    source_name = "cutshort"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []
        seen_urls = set()

        session = requests.Session()
        session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/138.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        })

        for slug in CATEGORY_SLUGS:
            try:
                html = self._fetch_category(session, slug)

                if not html:
                    continue

                if os.getenv("SCRAPER_DEBUG"):
                    with open(
                        f"cutshort_debug_{slug}.html",
                        "w",
                        encoding="utf-8",
                    ) as f:
                        f.write(html)

                soup = BeautifulSoup(html, "html.parser")
                cards = self._find_cards(soup)

                self.log.info(
                    "Cutshort [%s] found %d cards",
                    slug,
                    len(cards),
                )

                for card in cards:
                    try:
                        job = self._parse_card(card)

                        if not job:
                            continue

                        apply_url = job.get("apply_url")

                        if not apply_url or apply_url in seen_urls:
                            continue

                        seen_urls.add(apply_url)
                        jobs.append(job)

                    except Exception as e:
                        self.log.debug(
                            "Cutshort card parse failed: %s",
                            str(e),
                        )

            except Exception as e:
                self.log.warning(
                    "Cutshort failed [%s]: %s",
                    slug,
                    str(e),
                )

            time.sleep(random.uniform(1, 2))

        session.close()

        self.log.info(
            "Collected %d jobs from cutshort",
            len(jobs),
        )

        return jobs

    def _fetch_category(
        self,
        session: requests.Session,
        slug: str,
    ) -> str:

        url = f"{BASE}/jobs/{slug}"

        self.log.info(
            "Cutshort scrape: %s",
            url,
        )

        started = time.monotonic()

        response = session.get(
            url,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )

        elapsed = time.monotonic() - started

        self.log.info(
            "Cutshort [%s] HTTP %d in %.2fs",
            slug,
            response.status_code,
            elapsed,
        )

        response.raise_for_status()

        if not response.text:
            self.log.warning(
                "Cutshort [%s] returned empty HTML",
                slug,
            )
            return ""

        return response.text

    def _find_cards(self, soup: BeautifulSoup) -> List:

        cards = []
        seen = set()

        for h2 in soup.find_all("h2"):
            title_link = h2.find("a", href=True)

            if not title_link:
                continue

            title = title_link.get_text(
                " ",
                strip=True,
            )

            if not title:
                continue

            href = title_link.get("href", "")

            if not href or href in seen:
                continue

            container = h2.find_parent(
                ["article", "div", "li"]
            )

            hops = 0

            while (
                container
                and not container.find("h3")
                and hops < 4
            ):
                container = container.find_parent(
                    ["article", "div", "li"]
                )
                hops += 1

            if not container:
                continue

            seen.add(href)
            cards.append(container)

        return cards

    def _parse_card(
        self,
        card,
    ) -> Optional[Dict]:

        job = self._empty_job()

        h2 = card.find("h2")

        title_link = (
            h2.find("a", href=True)
            if h2
            else None
        )

        if not title_link:
            return None

        title = _clean(
            title_link.get_text(
                " ",
                strip=True,
            )
        )

        if not title:
            return None

        job["title"] = title

        h3 = card.find("h3")

        company_link = (
            h3.find("a")
            if h3
            else None
        )

        if company_link:
            job["company"] = _clean(
                company_link.get_text(
                    " ",
                    strip=True,
                )
            )
        elif h3:
            job["company"] = _clean(
                h3.get_text(
                    " ",
                    strip=True,
                )
            )
        else:
            job["company"] = ""

        text_blob = _clean(
            card.get_text(
                " ",
                strip=True,
            )
        )

        is_remote = bool(
            re.search(
                r"\bremote\b",
                text_blob,
                re.IGNORECASE,
            )
        )

        salary_match = re.search(
            r"₹[\d.,LKlakhs\s\-/yrmo]+",
            text_blob,
            re.IGNORECASE,
        )

        href = title_link.get("href", "")

        job["location"] = (
            "Remote"
            if is_remote
            else ""
        )

        job["salary"] = (
            salary_match.group(0).strip()
            if salary_match
            else ""
        )

        job["description"] = text_blob[:1000]
        job["skills"] = []

        job["type"] = (
            "internship"
            if "intern" in title.lower()
            else "full-time"
        )

        job["is_remote"] = is_remote
        job["posted_date"] = ""

        job["apply_url"] = (
            href
            if href.startswith("http")
            else urljoin(BASE, href)
        )

        return job


def _clean(text) -> str:
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()