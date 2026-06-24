import json
import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from scrapers.base import BaseScraper


BASE = "https://in.indeed.com"


class IndeedScraper(BaseScraper):
    source_name = "indeed"

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        combinations = [
            ("internship", "India"),
            ("fresher software developer", "India"),
            ("entry level data scientist", "India"),
            ("graduate trainee", "India"),
        ]

        for keyword, location in combinations:
            jobs.extend(self._search(keyword, location, max_pages))
            time.sleep(random.uniform(2, 4))

        self.log.info("Collected %d jobs from indeed", len(jobs))
        return jobs

    def _search(self, keyword: str, location: str, max_pages: int) -> List[Dict]:
        results = []

        for page in range(max_pages):
            start = page * 10
            url = f"{BASE}/jobs?q={quote(keyword)}&l={quote(location)}&start={start}"
            self.log.info("Indeed scrape: %s", url)

            try:
                html = self._render_page(url)
            except Exception as e:
                self.log.warning("Indeed render failed: %s", str(e))
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(f"indeed_debug_{page}.html", "w", encoding="utf-8") as f:
                    f.write(html)

            soup = BeautifulSoup(html, "html.parser")
            selectors = [
                '[data-jk]',
                "div.job_seen_beacon",
                "td.resultContent",
                ".jobsearch-ResultsList > li",
                ".slider_container .slider_item",
            ]

            cards = []
            for selector in selectors:
                cards = soup.select(selector)
                if cards:
                    break

            self.log.info("Indeed found %d cards", len(cards))

            if not cards:
                results.extend(self._extract_jsonld(soup))
                continue

            for card in cards:
                try:
                    job = self._parse_card(card)
                    if job:
                        results.append(job)
                except Exception:
                    continue

            results.extend(self._extract_jsonld(soup))
            time.sleep(random.uniform(2, 5))

        return results

    def _render_page(self, url: str) -> str:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1400, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(7000)

            try:
                for _ in range(3):
                    page.mouse.wheel(0, 4000)
                    page.wait_for_timeout(random.randint(1000, 2500))
            except Exception:
                pass

            html = page.content()
            browser.close()
            return html

    def _parse_card(self, card) -> Optional[Dict]:
        job = self._empty_job()

        title_el = (
            card.select_one('[data-testid="jobTitle"]')
            or card.select_one("h2.jobTitle")
            or card.select_one(".jobTitle")
            or card.select_one("h2")
            or card.select_one("a")
        )
        company_el = card.select_one('[data-testid="company-name"]') or card.select_one(".companyName")
        location_el = card.select_one('[data-testid="text-location"]') or card.select_one(".companyLocation")
        salary_el = card.select_one('[data-testid="attribute_snippet_testid"]') or card.select_one(".salary-snippet") or card.select_one(".estimated-salary")
        link_el = card.select_one("a")

        title = _clean(title_el.get_text(" ", strip=True) if title_el else "")
        if not title:
            return None

        job["title"] = title
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")
        job["location"] = _clean(location_el.get_text(strip=True) if location_el else "")
        job["salary"] = _clean(salary_el.get_text(strip=True) if salary_el else "")
        job["description"] = _clean(card.get_text(" ", strip=True))
        job["skills"] = []
        job["posted_date"] = ""
        job["experience_required"] = ""
        job["type"] = _infer_type(job["title"])
        job["is_remote"] = "remote" in job["location"].lower()

        href = link_el.get("href") if link_el else ""
        job["apply_url"] = href if href.startswith("http") else (urljoin(BASE, href) if href else "")
        return job

    def _extract_jsonld(self, soup) -> List[Dict]:
        results = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                json_ld = json.loads(script.string or "")
            except Exception:
                continue

            items = json_ld if isinstance(json_ld, list) else [json_ld]
            for item in items:
                if isinstance(item, dict) and item.get("@type") == "JobPosting":
                    job = self._parse_jsonld(item)
                    if job:
                        results.append(job)

        return results

    def _parse_jsonld(self, json_ld: Dict) -> Optional[Dict]:
        job = self._empty_job()
        job["title"] = _clean(json_ld.get("title", ""))
        if not job["title"]:
            return None

        job["company"] = _clean(json_ld.get("hiringOrganization", {}).get("name", ""))
        job["location"] = _clean(
            json_ld.get("jobLocation", {}).get("address", {}).get("addressLocality", "")
        )
        description = re.sub(r"<[^>]+>", " ", json_ld.get("description", "") or "")
        job["description"] = _clean(description)
        job["posted_date"] = json_ld.get("datePosted", "")
        job["apply_url"] = json_ld.get("url", "")
        job["skills"] = []
        job["experience_required"] = ""
        job["type"] = _infer_type(job["title"])
        job["is_remote"] = "remote" in job["location"].lower()
        return job


def _clean(text) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _infer_type(title: str) -> str:
    title = (title or "").lower()
    return "internship" if "intern" in title else "full-time"