import json
import os
import random
import re
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlencode, urljoin

from bs4 import BeautifulSoup

from config import COMPANY_PORTALS
from scrapers.base import BaseScraper
from utils import safe_get


MAX_PORTAL_PAGES = 5
MIN_CARD_MATCHES = 2
MAX_CARD_MATCHES = 250

WHITESPACE_RE = re.compile(r"\s+")
TAG_RE = re.compile(r"<[^>]+>")

JOB_KEYWORDS = frozenset((
    "intern", "trainee", "engineer", "developer", "analyst", "manager",
    "associate", "specialist", "consultant", "executive", "lead",
    "designer", "scientist", "architect", "officer", "coordinator",
    "graduate", "fresher",
))

JOB_HREF_KEYWORDS = (
    "job", "career", "opening", "position", "vacan", "apply",
    "requisition", "req/",
)

CARD_SELECTOR_CANDIDATES = [
    "article", ".job-card", ".opening", ".job-listing", ".job-item",
    ".job-row", ".job-tile", ".position", ".posting", ".vacancy",
    "li.job", "tr.job",
    '[class*="job-card"]', '[class*="jobCard"]', '[class*="job-item"]',
    '[class*="jobItem"]', '[class*="job-listing"]', '[class*="posting"]',
    '[data-testid*="job"]', '[data-automation-id*="job"]',
    '[class*="opening"]', '[class*="vacan"]', '[class*="career"]',
    '[class*="job"]',
]

EMPLOYMENT_TYPE_MAP = {
    "FULL_TIME": "full-time",
    "Full-Time": "full-time",
    "Internship": "internship",
    "INTERN": "internship",
    "PART_TIME": "part-time",
    "TEMPORARY": "contract",
    "CONTRACT": "contract",
}


def _clean(text) -> str:
    return WHITESPACE_RE.sub(" ", str(text or "")).strip()


def _text(soup, selector: str) -> str:
    element = soup.select_one(selector)
    if not element:
        return ""
    return _clean(element.get_text(" ", strip=True))


def _infer_type(title: str) -> str:
    title = (title or "").lower()
    if "intern" in title:
        return "internship"
    if "contract" in title or "freelance" in title:
        return "contract"
    return "full-time"


def _map_employment_type(employment_type) -> str:
    if isinstance(employment_type, list):
        employment_type = employment_type[0] if employment_type else ""
    return EMPLOYMENT_TYPE_MAP.get(str(employment_type), _infer_type(str(employment_type)))


def _salary_from_jsonld(base_salary) -> str:
    if not isinstance(base_salary, dict):
        return ""

    value = base_salary.get("value", {})
    if not isinstance(value, dict):
        return str(base_salary)

    minimum = value.get("minValue")
    maximum = value.get("maxValue")
    unit = value.get("unitText", "")
    currency = base_salary.get("currency", "INR")

    if minimum is not None and maximum is not None:
        return f"{currency} {minimum}-{maximum} {unit}".strip()
    if minimum is not None:
        return f"{currency} {minimum}+ {unit}".strip()
    return ""


def _extract_items(data) -> List[Dict]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    if not isinstance(data, dict):
        return []

    for key in ("jobs", "jobListings", "results", "data", "items", "postings", "elements"):
        candidate = data.get(key)

        if isinstance(candidate, list):
            return [item for item in candidate if isinstance(item, dict)]

        if isinstance(candidate, dict):
            for inner_key in ("jobs", "results", "data", "items"):
                inner = candidate.get(inner_key)
                if isinstance(inner, list):
                    return [item for item in inner if isinstance(item, dict)]

    return []


def _has_link(card) -> bool:
    if card.name == "a" and card.has_attr("href"):
        return True
    return card.select_one("a[href]") is not None


def _find_link(card):
    if card.name == "a" and card.has_attr("href"):
        return card
    return card.select_one("a[href]")


def _dedupe_key(job: Dict) -> Tuple[str, str]:
    return (
        (job.get("title") or "").lower(),
        (job.get("apply_url") or "").lower(),
    )


class CompanyPortalsScraper(BaseScraper):

    source_name = "company_portals"

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []

        for company_key, portal_config in COMPANY_PORTALS.items():
            self.log.info("Scraping company portal: %s", portal_config["name"])

            try:
                batch = self._search(company_key, portal_config, max_pages)
                jobs.extend(batch)
                self.log.info("%s -> %d listings", portal_config["name"], len(batch))
            except Exception as exc:
                self.log.error("Company portal %s failed: %s", company_key, exc, exc_info=True)

            time.sleep(random.uniform(2, 4))

        self.log.info("Collected %d jobs from company portals", len(jobs))
        return jobs

    def _search(self, company_key: str, config: Dict, max_pages: int) -> List[Dict]:
        if config.get("type", "html") == "api":
            return self._search_api(company_key, config, max_pages)
        return self._search_html(company_key, config, max_pages)

    def _new_job(self, config: Dict) -> Dict:
        job = self._empty_job()
        job["company"] = config["name"]
        job["source"] = f"company_portal_{config['name'].lower().replace(' ', '_')}"
        return job

    def _search_html(self, company_key: str, config: Dict, max_pages: int) -> List[Dict]:
        results: List[Dict] = []
        seen = set()

        base_url = config.get("jobs_url", config.get("base_url", ""))
        if not base_url:
            return results

        selectors = config.get("selectors", {})
        base_params = config.get("params", {})
        page_limit = min(max_pages, MAX_PORTAL_PAGES)

        for page_num in range(1, page_limit + 1):
            params = {**base_params, "page": page_num}
            query = urlencode(params, doseq=True)
            url = f"{base_url}?{query}" if query else base_url

            self.log.info("%s scrape: %s", config["name"], url)

            try:
                html = self._render_page(url)
            except Exception as exc:
                self.log.warning("%s render failed: %s", config["name"], exc)
                continue

            if os.getenv("SCRAPER_DEBUG"):
                with open(f"{company_key}_debug_{page_num}.html", "w", encoding="utf-8") as debug_file:
                    debug_file.write(html)

            soup = BeautifulSoup(html, "html.parser")

            page_jobs = self._extract_jsonld_jobs(soup, config)
            cards, used_selector = self._find_cards(soup, selectors.get("job_cards"))

            self.log.info(
                "%s page %d: %d jsonld, %d cards via %s",
                config["name"], page_num, len(page_jobs), len(cards), used_selector,
            )

            for card in cards:
                try:
                    job = self._parse_html_card(card, config, selectors)
                except Exception:
                    continue
                if job:
                    page_jobs.append(job)

            if not page_jobs:
                heuristic_jobs = self._heuristic_extract(soup, config, base_url)
                self.log.info("%s page %d: %d heuristic jobs", config["name"], page_num, len(heuristic_jobs))
                page_jobs.extend(heuristic_jobs)

            new_count = self._collect_new(page_jobs, seen, results)
            self.log.info("%s page %d -> %d new jobs", config["name"], page_num, new_count)

            if new_count == 0:
                break

            time.sleep(random.uniform(2, 5))

        return results

    def _search_api(self, company_key: str, config: Dict, max_pages: int) -> List[Dict]:
        results: List[Dict] = []
        seen = set()

        api_url = config.get("api_url", "")
        if not api_url:
            return results

        base_params = dict(config.get("api_params", {}))
        page_limit = min(max_pages, MAX_PORTAL_PAGES)

        for page_num in range(1, page_limit + 1):
            params = {**base_params, "page": page_num}
            self.log.info("%s API page %d", config["name"], page_num)

            response = safe_get(self.session, api_url, params=params, domain_key=company_key)
            if not response:
                break

            try:
                data = response.json()
            except Exception:
                self.log.warning("%s returned invalid JSON", config["name"])
                break

            items = _extract_items(data)
            if not items:
                break

            page_jobs = []
            for raw in items:
                try:
                    job = self._parse_api_item(raw, config)
                except Exception:
                    continue
                if job:
                    page_jobs.append(job)

            new_count = self._collect_new(page_jobs, seen, results)
            self.log.info("%s API page %d -> %d new jobs", config["name"], page_num, new_count)

            if new_count == 0:
                break

            time.sleep(random.uniform(1, 3))

        return results

    @staticmethod
    def _collect_new(page_jobs: List[Dict], seen: set, results: List[Dict]) -> int:
        new_count = 0
        for job in page_jobs:
            key = _dedupe_key(job)
            if key in seen:
                continue
            seen.add(key)
            results.append(job)
            new_count += 1
        return new_count

    def _render_page(self, url: str) -> str:
        page = self.new_page()
        try:
            self.goto(page, url)
            page.wait_for_timeout(5000)

            for _ in range(4):
                page.mouse.wheel(0, 4000)
                page.wait_for_timeout(random.randint(1000, 2200))

            return page.content()
        finally:
            page.context.close()

    def _find_cards(self, soup, configured_selector: Optional[str]):
        selector_list = []
        if configured_selector:
            selector_list.append(configured_selector)
        selector_list.extend(CARD_SELECTOR_CANDIDATES)

        best_cards, best_selector, best_score = [], "none", -1

        for selector in selector_list:
            try:
                cards = soup.select(selector)
            except Exception:
                continue

            count = len(cards)
            if count < MIN_CARD_MATCHES or count > MAX_CARD_MATCHES:
                continue

            score = sum(1 for card in cards if _has_link(card))
            if score < count * 0.5:
                continue

            if configured_selector and selector == configured_selector:
                return cards, selector

            if score > best_score:
                best_cards, best_selector, best_score = cards, selector, score

        return (best_cards, best_selector) if best_score >= 0 else ([], "none")

    def _heuristic_extract(self, soup, config: Dict, base_url: str) -> List[Dict]:
        results: List[Dict] = []
        seen_titles = set()

        for link in soup.select("a[href]"):
            text = _clean(link.get_text(" ", strip=True))
            href = link.get("href", "")

            if not text or len(text) < 4 or len(text) > 120:
                continue

            text_lower = text.lower()
            href_lower = href.lower()

            title_match = any(keyword in text_lower for keyword in JOB_KEYWORDS)
            href_match = any(keyword in href_lower for keyword in JOB_HREF_KEYWORDS)

            if not (title_match or href_match):
                continue

            if text_lower in seen_titles:
                continue
            seen_titles.add(text_lower)

            job = self._new_job(config)
            job["title"] = text

            container = link.find_parent(["li", "tr", "div", "article"])
            job["description"] = _clean(container.get_text(" ", strip=True)) if container else text
            job["apply_url"] = urljoin(base_url, href)
            job["type"] = _infer_type(text)
            job["is_remote"] = "remote" in job["description"].lower()

            results.append(job)

        return results

    def _extract_jsonld_jobs(self, soup, config: Dict) -> List[Dict]:
        results: List[Dict] = []

        for script in soup.select('script[type="application/ld+json"]'):
            try:
                payload = json.loads(script.string or "")
            except Exception:
                continue

            items = []
            if isinstance(payload, list):
                items.extend(payload)
            elif isinstance(payload, dict):
                items.append(payload)
                graph = payload.get("@graph")
                if isinstance(graph, list):
                    items.extend(graph)

            for item in items:
                if not isinstance(item, dict) or item.get("@type") != "JobPosting":
                    continue
                job = self._parse_jsonld(item, config)
                if job:
                    results.append(job)

        return results

    def _parse_html_card(self, card, config: Dict, selectors: Dict) -> Optional[Dict]:
        job = self._new_job(config)

        title_selectors = [
            selectors.get("title", ""),
            "h2", "h3", "h4", ".title", '[class*="title"]', "a",
        ]

        title = ""
        for selector in title_selectors:
            if not selector:
                continue
            element = card.select_one(selector)
            if not element:
                continue
            title = _clean(element.get_text(" ", strip=True))
            if title:
                break

        if not title and card.name == "a":
            title = _clean(card.get_text(" ", strip=True))[:120]

        if not title:
            return None

        job["title"] = title
        job["location"] = _text(card, selectors.get("location", '.location, [class*="location"]'))
        job["salary"] = _text(card, selectors.get("salary", '.salary, [class*="salary"]'))
        job["stipend"] = job["salary"]
        job["duration"] = _text(card, selectors.get("duration", '.duration, [class*="duration"]'))
        job["description"] = _clean(card.get_text(" ", strip=True))

        link = _find_link(card)
        job["apply_url"] = urljoin(config.get("base_url", ""), link.get("href", "")) if link else ""

        job["type"] = _infer_type(job["title"])
        job["is_remote"] = "remote" in job["location"].lower()

        return job

    def _parse_jsonld(self, json_ld: Dict, config: Dict) -> Optional[Dict]:
        job = self._new_job(config)

        job["title"] = _clean(json_ld.get("title", ""))
        if not job["title"]:
            return None

        job_location = json_ld.get("jobLocation")
        if isinstance(job_location, list) and job_location:
            job_location = job_location[0]

        if isinstance(job_location, dict):
            address = job_location.get("address", {})
            if not isinstance(address, dict):
                address = {}
            job["location"] = _clean(address.get("addressLocality", ""))
        else:
            job["location"] = _clean(job_location)

        job["description"] = _clean(TAG_RE.sub(" ", str(json_ld.get("description", "") or "")))
        job["posted_date"] = json_ld.get("datePosted", "")
        job["deadline"] = json_ld.get("validThrough", "")
        job["salary"] = _salary_from_jsonld(json_ld.get("baseSalary", {}))
        job["type"] = _map_employment_type(json_ld.get("employmentType", ""))

        apply_field = json_ld.get("apply", {})
        if not isinstance(apply_field, dict):
            apply_field = {}

        job["apply_url"] = json_ld.get("url", "") or apply_field.get("url", "")
        job["is_remote"] = "remote" in job["location"].lower()

        return job

    def _parse_api_item(self, raw: Dict, config: Dict) -> Optional[Dict]:
        job = self._new_job(config)

        job["title"] = _clean(raw.get("title", "") or raw.get("name", "") or raw.get("jobTitle", ""))
        if not job["title"]:
            return None

        job["location"] = _clean(
            raw.get("location", "")
            or raw.get("city", "")
            or raw.get("locationName", "")
            or raw.get("primaryLocation", "")
        )

        job["description"] = _clean(TAG_RE.sub(" ", str(raw.get("description", "") or "")))
        job["salary"] = str(raw.get("salary", "") or raw.get("ctc", "") or "")

        job["apply_url"] = (
            raw.get("url", "")
            or raw.get("apply_url", "")
            or raw.get("jobUrl", "")
            or raw.get("applyURL", "")
        )

        job["posted_date"] = str(raw.get("postedDate", "") or raw.get("created_at", "") or "")
        job["type"] = _infer_type(job["title"])
        job["is_remote"] = "remote" in job["location"].lower()

        return job