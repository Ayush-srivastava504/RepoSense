import json
import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://www.glassdoor.co.in"

BLOCK_INDICATORS = (
    "verify you're a human",
    "verify you are a human",
    "additional security check",
    "let's confirm you're human",
    "captcha",
    "access denied",
    "unusual traffic",
    "sign in to continue",
)


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

        blocked_count = 0

        for keyword in keyword_queries[:4]:

            batch, blocked = self._search(keyword, max_pages)

            jobs.extend(batch)

            if blocked:
                blocked_count += 1

            time.sleep(random.uniform(2, 5))

        if blocked_count == len(keyword_queries[:4]) and not jobs:
            self.log.warning(
                "Glassdoor: every query hit a bot-check/login wall. "
                "This is Glassdoor's anti-scraping layer, not a selector "
                "problem — a headless Playwright session gets flagged. "
                "You'd need stealth-plugin tooling or a residential-proxy "
                "unlocking service to get past this reliably."
            )

        self.log.info("Collected %d jobs from glassdoor", len(jobs))

        return jobs

    def _search(self, keyword: str, max_pages: int) -> (List[Dict], bool):

        results = []
        hit_block_wall = False

        for page in range(1, max_pages + 1):

            url = f"{BASE}/Job/jobs.htm?sc.keyword={quote(keyword)}&p={page}"

            self.log.info("Glassdoor scrape: %s", url)

            try:
                html, final_url, title = self._render_page(url)
            except Exception as e:
                self.log.warning("Glassdoor render failed: %s", str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(
                    f"glassdoor_debug_{page}.html", "w", encoding="utf-8"
                ) as f:
                    f.write(html)

            lowered = (html or "").lower()
            if any(indicator in lowered for indicator in BLOCK_INDICATORS):
                hit_block_wall = True
                self.log.warning(
                    "Glassdoor: bot-check/login page served for kw=%r page=%d "
                    "(url=%s, title=%r) — no job data to extract here.",
                    keyword,
                    page,
                    final_url,
                    title,
                )
                break

            soup = BeautifulSoup(html, "html.parser")

            cards = self._find_cards(soup)

            self.log.info("Glassdoor found %d cards", len(cards))

            if not cards:
                jsonld_jobs = self._from_jsonld(soup)
                if jsonld_jobs:
                    results.extend(jsonld_jobs)
                else:
                    body_snippet = soup.get_text(" ", strip=True)[:300]
                    self.log.info(
                        "Glassdoor: 0 cards, 0 JSON-LD for kw=%r page=%d "
                        "(url=%s, title=%r, body_snippet=%r)",
                        keyword,
                        page,
                        final_url,
                        title,
                        body_snippet,
                    )
                continue

            for card in cards:
                try:
                    job = self._parse_card(card)
                    if job:
                        results.append(job)
                except Exception:
                    continue

            time.sleep(random.uniform(2, 4))

        return results, hit_block_wall

    def _render_page(self, url: str) -> (str, str, str):

        page = self.new_page()

        try:
            self.goto(page, url)
            page.wait_for_timeout(8000)

            try:
                for _ in range(4):
                    page.mouse.wheel(0, 4000)
                    page.wait_for_timeout(random.randint(1200, 3000))
            except Exception:
                pass

            return page.content(), page.url, page.title()

        finally:
            page.context.close()

    def _find_cards(self, soup) -> List:
        # Structural/data-test attributes first (Glassdoor rotates its
        # hashed CSS module classnames on basically every deploy — those
        # are a losing game to chase). Visual classnames kept as last resort.
        selectors = [
            '[data-test="jobListing"]',
            "li.react-job-listing",
            "article[data-id]",
            '[class*="JobsList_jobListItem"]',
            '[class*="jobListing"]',
        ]

        for selector in selectors:
            cards = soup.select(selector)
            if cards:
                return cards

        return []

    def _from_jsonld(self, soup) -> List[Dict]:
        jobs = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                parsed = json.loads(script.string or "")
            except Exception:
                continue

            items = parsed if isinstance(parsed, list) else [parsed]
            for item in items:
                if not isinstance(item, dict) or item.get("@type") != "JobPosting":
                    continue

                job = self._empty_job()
                job["title"] = _clean(item.get("title", ""))
                if not job["title"]:
                    continue

                org = item.get("hiringOrganization", {})
                job["company"] = _clean(
                    org.get("name", "") if isinstance(org, dict) else str(org)
                )

                loc = item.get("jobLocation", {})
                address = loc.get("address", {}) if isinstance(loc, dict) else {}
                job["location"] = _clean(
                    address.get("addressLocality", "")
                    if isinstance(address, dict)
                    else ""
                )

                description = re.sub(r"<[^>]+>", " ", item.get("description", ""))
                job["description"] = _clean(description)
                job["skills"] = []
                job["posted_date"] = item.get("datePosted", "")
                job["salary"] = ""
                job["type"] = (
                    "internship" if "intern" in job["title"].lower() else "full-time"
                )
                job["is_remote"] = "remote" in job["location"].lower()
                job["apply_url"] = item.get("url", "")

                jobs.append(job)

        return jobs

    def _parse_card(self, card) -> Optional[Dict]:

        job = self._empty_job()

        title_el = (
            card.select_one('[data-test="job-title"]')
            or card.select_one('[class*="jobTitle"]')
            or card.select_one("h2")
            or card.select_one("a")
        )

        company_el = card.select_one('[data-test="employer-name"]') or card.select_one(
            '[class*="EmployerProfile"]'
        )

        location_el = card.select_one('[data-test="location"]') or card.select_one(
            '[class*="location"]'
        )

        salary_el = card.select_one('[data-test="detailSalary"]') or card.select_one(
            '[class*="salaryEstimate"]'
        )

        link_el = card.select_one("a")

        title = _clean(title_el.get_text(" ", strip=True) if title_el else "")

        if not title:
            return None

        job["title"] = title
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")
        job["location"] = _clean(
            location_el.get_text(strip=True) if location_el else ""
        )
        job["salary"] = _clean(salary_el.get_text(strip=True) if salary_el else "")
        job["description"] = _clean(card.get_text(" ", strip=True))
        job["skills"] = []
        job["posted_date"] = ""
        job["type"] = "internship" if "intern" in job["title"].lower() else "full-time"
        job["is_remote"] = "remote" in job["location"].lower()

        href = link_el.get("href") if link_el else ""
        if href:
            job["apply_url"] = href if href.startswith("http") else urljoin(BASE, href)
        else:
            job["apply_url"] = ""

        return job


def _clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()