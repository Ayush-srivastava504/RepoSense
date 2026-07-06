import json
import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://in.indeed.com"

BLOCK_INDICATORS = (
    "additional verification required",
    "verify you are a human",
    "unusual traffic",
    "captcha",
    "access to this page has been denied",
    "just a moment",  # classic Cloudflare interstitial title
)


class IndeedScraper(BaseScraper):

    source_name = "indeed"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        combinations = [
            ("internship", "India"),
            ("fresher software developer", "India"),
            ("entry level data scientist", "India"),
            ("graduate trainee", "India"),
        ]

        blocked_count = 0

        for keyword, location in combinations:
            batch, blocked = self._search(keyword, location, max_pages)
            jobs.extend(batch)
            if blocked:
                blocked_count += 1
            time.sleep(random.uniform(2, 4))

        if blocked_count == len(combinations) and not jobs:
            self.log.warning(
                "Indeed: every query hit a bot-check/interstitial page. "
                "This is Indeed/Cloudflare's anti-bot layer flagging the "
                "headless session, not a selector problem — plain "
                "Playwright headless Chromium is fingerprinted here. "
                "Fixing this needs stealth-plugin tooling or a proxy/"
                "unlocking service, not different CSS selectors."
            )

        self.log.info("Collected %d jobs from indeed", len(jobs))

        return jobs

    def _search(
        self, keyword: str, location: str, max_pages: int
    ) -> (List[Dict], bool):

        results = []
        hit_block_wall = False

        for page in range(max_pages):

            start = page * 10

            url = f"{BASE}/jobs?q={quote(keyword)}&l={quote(location)}&start={start}"

            self.log.info("Indeed scrape: %s", url)

            try:
                html, final_url, title = self._render_page(url)
            except Exception as e:
                self.log.warning("Indeed render failed: %s", str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(f"indeed_debug_{page}.html", "w", encoding="utf-8") as f:
                    f.write(html)

            lowered = (html or "").lower()
            if any(indicator in lowered for indicator in BLOCK_INDICATORS):
                hit_block_wall = True
                self.log.warning(
                    "Indeed: bot-check page served for kw=%r page=%d "
                    "(url=%s, title=%r) — no job data here.",
                    keyword,
                    page,
                    final_url,
                    title,
                )
                break

            soup = BeautifulSoup(html, "html.parser")

            cards = self._find_cards(soup)

            self.log.info("Indeed found %d cards", len(cards))

            if not cards:
                jsonld_jobs = self._from_jsonld(soup)
                if jsonld_jobs:
                    results.extend(jsonld_jobs)
                else:
                    href_jobs = self._from_href_pattern(soup)
                    if href_jobs:
                        results.extend(href_jobs)
                    else:
                        body_snippet = soup.get_text(" ", strip=True)[:300]
                        self.log.info(
                            "Indeed: 0 cards/JSON-LD/hrefs for kw=%r page=%d "
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

            time.sleep(random.uniform(2, 5))

        return results, hit_block_wall

    def _render_page(self, url: str) -> (str, str, str):

        page = self.new_page()

        try:
            self.goto(page, url)
            page.wait_for_timeout(7000)

            try:
                for _ in range(3):
                    page.mouse.wheel(0, 4000)
                    page.wait_for_timeout(random.randint(1000, 2500))
            except Exception:
                pass

            return page.content(), page.url, page.title()

        finally:
            page.context.close()

    def _find_cards(self, soup) -> List:
        selectors = [
            "div.job_seen_beacon",
            '[data-jk]',
            "td.resultContent",
            ".jobsearch-ResultsList > li",
            ".slider_container .slider_item",
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
                job["experience_required"] = ""
                job["salary"] = ""
                job["type"] = _infer_type(job["title"])
                job["is_remote"] = "remote" in job["location"].lower()
                job["apply_url"] = item.get("url", "")

                jobs.append(job)

        return jobs

    def _from_href_pattern(self, soup) -> List[Dict]:
        # Indeed job links always route through /rc/clk or /pagead/clk or
        # contain a jk= param — these are far more stable than the visual
        # card wrapper classes.
        link_pattern = re.compile(r"(/rc/clk|/pagead/clk|[?&]jk=)")
        jobs = []
        seen = set()

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not link_pattern.search(href):
                continue

            title = _clean(a.get_text(" ", strip=True))
            if not title or len(title) < 3:
                continue

            apply_url = href if href.startswith("http") else urljoin(BASE, href)
            if apply_url in seen:
                continue
            seen.add(apply_url)

            job = self._empty_job()
            job["title"] = title
            job["company"] = ""
            job["location"] = ""
            job["salary"] = ""
            job["description"] = ""
            job["skills"] = []
            job["posted_date"] = ""
            job["experience_required"] = ""
            job["type"] = _infer_type(title)
            job["is_remote"] = False
            job["apply_url"] = apply_url

            jobs.append(job)

        return jobs

    def _parse_card(self, card) -> Optional[Dict]:

        job = self._empty_job()

        title_el = (
            card.select_one("h2.jobTitle")
            or card.select_one(".jobTitle")
            or card.select_one("h2")
            or card.select_one("a")
        )

        company_el = card.select_one(".companyName") or card.select_one(
            '[data-testid="company-name"]'
        )

        location_el = card.select_one(".companyLocation") or card.select_one(
            '[data-testid="text-location"]'
        )

        salary_el = card.select_one(".salary-snippet") or card.select_one(
            ".estimated-salary"
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
        job["experience_required"] = ""
        job["type"] = _infer_type(job["title"])
        job["is_remote"] = "remote" in job["location"].lower()

        href = link_el.get("href") if link_el else ""
        if href:
            job["apply_url"] = href if href.startswith("http") else urljoin(BASE, href)
        else:
            job["apply_url"] = ""

        return job


def _clean(text) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _infer_type(title: str) -> str:
    title = (title or "").lower()
    return "internship" if "intern" in title else "full-time"