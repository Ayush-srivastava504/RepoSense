"""
Generic "smart" board scraper.

Greenhouse/Lever/Ashby/SmartRecruiters/Workable (see greenhouse.py,
lever.py, ashby.py, smartrecruiters.py, workable.py) each have a clean,
documented, unauthenticated JSON API — one shared fetch/parse module
(ats_common.py) is all they need.

Jobvite, iCIMS, and Teamtailor don't expose one consistent public JSON
API across every company that uses them (Jobvite is highly per-instance,
iCIMS is enterprise/portal-based, Teamtailor's real API needs a partner
key). JapanDev, TokyoDev, and most internship boards (GradConnection,
Prosple, WayUp, Parker Dewey, Levels.fyi's internship board, etc.) are
just individual sites, not ATS platforms, so there's no API pattern to
share at all.

The one thing almost all of these *do* have in common: modern job/career
pages embed schema.org `JobPosting` JSON-LD in a `<script
type="application/ld+json">` tag for SEO (Google for Jobs indexing).
That's a structured, stable contract that doesn't break when a site
redesigns its CSS — much sturdier than hand-written selectors. So this
scraper is "smart" in the sense that it doesn't need per-site selectors
maintained at all: point it at a board's listing/search URL and it reads
the structured data the site already publishes for search engines.

If a page has no JSON-LD (some smaller boards don't bother), it falls
back to a conservative heuristic: job-shaped link text + a job-shaped
href pattern, same idea as scrapers/company_portals.py's fallback.

Configure boards to crawl in config.py under GENERIC_BOARDS — each entry
is {"name": ..., "url": ..., "source_tag": ...}. source_tag lets several
board entries roll up into one crawler-summary bucket (e.g. several
Jobvite instances all tagged "jobvite") while still being separate
config entries with separate URLs.
"""

import json
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from config import GENERIC_BOARDS
from scrapers.ats_common import build_job, clean, dedupe
from scrapers.base import BaseScraper

WHITESPACE_RE = re.compile(r"\s+")

JOB_HREF_KEYWORDS = (
    "/job/", "/jobs/", "/career/", "/careers/", "/opening/", "/openings/",
    "/position/", "/positions/", "/vacancy/", "/vacancies/", "/req/",
    "requisition", "jobid=", "job_id=", "job-id=",
)

JOB_TITLE_KEYWORDS = frozenset((
    "intern", "internship", "trainee", "engineer", "developer", "analyst",
    "manager", "associate", "specialist", "consultant", "executive",
    "lead", "designer", "scientist", "architect", "officer",
    "coordinator", "graduate", "fresher", "researcher",
))


class GenericBoardsScraper(BaseScraper):

    source_name = "generic_boards"
    uses_browser = True  # most of these are JS-rendered SPAs

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        boards = GENERIC_BOARDS
        jobs: List[Dict] = []

        for board in boards:
            name = board.get("name", board.get("url", "unknown"))
            try:
                batch = self._scrape_board(board)
                self.log.info("%s -> %d jobs", name, len(batch))
                jobs.extend(batch)
            except Exception as exc:
                self.log.error("Generic board '%s' failed: %s", name, exc, exc_info=True)

        jobs = dedupe(jobs)
        self.log.info("Generic boards collected %d jobs across %d boards", len(jobs), len(boards))
        return jobs

    def _scrape_board(self, board: Dict) -> List[Dict]:
        url = board["url"]
        source_tag = board.get("source_tag", self.source_name)
        company_hint = board.get("company_hint", "")

        page = self.new_page()
        try:
            self.goto(page, url)
            page.wait_for_timeout(3000)
            for _ in range(3):
                page.mouse.wheel(0, 3000)
                page.wait_for_timeout(800)
            html = page.content()
        finally:
            page.context.close()

        soup = BeautifulSoup(html, "html.parser")

        jobs = self._extract_jsonld(soup, url, source_tag, company_hint)

        if not jobs:
            jobs = self._extract_heuristic(soup, url, source_tag, company_hint)

        return jobs

    def _extract_jsonld(self, soup, base_url: str, source_tag: str, company_hint: str) -> List[Dict]:
        out = []

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

                title = clean(item.get("title", ""))
                if not title:
                    continue

                org = item.get("hiringOrganization")
                company = ""
                if isinstance(org, dict):
                    company = clean(org.get("name", ""))
                company = company or company_hint

                job_location = item.get("jobLocation")
                if isinstance(job_location, list) and job_location:
                    job_location = job_location[0]
                location = ""
                if isinstance(job_location, dict):
                    address = job_location.get("address", {})
                    if isinstance(address, dict):
                        location = clean(address.get("addressLocality", "") or address.get("addressRegion", ""))

                apply_url = clean(item.get("url", "")) or base_url

                job = build_job(
                    title=title,
                    company=company,
                    location=location,
                    description=item.get("description", ""),
                    apply_url=apply_url,
                    posted_date=item.get("datePosted", ""),
                    source=source_tag,
                )
                if job:
                    out.append(job)

        return out

    def _extract_heuristic(self, soup, base_url: str, source_tag: str, company_hint: str) -> List[Dict]:
        out = []
        seen_titles = set()

        for link in soup.select("a[href]"):
            text = clean(link.get_text(" ", strip=True))
            href = link.get("href", "")

            if not text or len(text) < 4 or len(text) > 120:
                continue

            lowered = text.lower()
            if lowered in seen_titles:
                continue

            if not any(kw in lowered for kw in JOB_TITLE_KEYWORDS):
                continue

            href_lower = href.lower()
            if not any(kw in href_lower for kw in JOB_HREF_KEYWORDS):
                continue

            seen_titles.add(lowered)

            container = link.find_parent(["li", "tr", "div", "article"])
            description = clean(container.get_text(" ", strip=True)) if container else text

            job = build_job(
                title=text,
                company=company_hint or "",
                location="",
                description=description,
                apply_url=urljoin(base_url, href),
                source=source_tag,
            )
            if job:
                out.append(job)

        return out
