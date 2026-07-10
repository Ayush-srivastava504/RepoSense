"""
FreeJobAlert — https://www.freejobalert.com

Private aggregator (est. 2011) that republishes government/PSU/bank
recruitment notifications — UPSC, SSC, Railways, Banking, State PSCs,
Police/Defence, Teaching, etc. — under its own domain rather than the
notifying authority's official *.gov.in / *.nic.in site.

We deliberately scrape this aggregator instead of hitting ssc.nic.in or
upsc.gov.in directly: government portals are more likely to rate-limit,
block, or otherwise take issue with automated access, whereas a
third-party news/aggregator site republishing already-public notices is
a materially different, lower-risk target. Because of that, apply_url
here points at freejobalert.com's own article page (which in turn links
out to the official notification), not at a *.gov.in domain — so these
jobs won't earn the "Verified Source" badge from processors/trust.py,
which is expected and correct.

The "Latest Notifications" page is a single long, mostly static HTML
page: a series of category headings (Banks, UPSC, SSC, Railways, each
state, etc.) each immediately followed by a <table> of postings with
columns Post Date | Recruitment Board | Exam/Post Name | Qualification |
Advt No | Last Date | More Information. No browser/JS rendering is
needed — requests + BeautifulSoup is enough. As with the other
government-adjacent scrapers in this repo, selectors are written
defensively (several candidate selectors tried in order, per-row
try/except) since the page's markup isn't under our control and can
change without notice.
"""

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from utils import safe_get


BASE = "https://www.freejobalert.com"
LISTING_URL = f"{BASE}/latest-notifications/"

TABLE_SELECTORS = [
    "table.jobtable",
    ".job-table",
    "table",
]

DATE_RE = re.compile(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})")

# Only keep rows whose category heading looks like an actual recruitment
# section, not stray tables (ads, "related links", etc.) that may share
# the same generic selector.
SKIP_ROW_TEXT = (
    "no jobs are currently available",
)


class FreeJobAlertScraper(BaseScraper):

    source_name = "freejobalert"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        resp = safe_get(
            self.session,
            LISTING_URL,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            },
            domain_key="freejobalert",
        )

        if resp is None:
            self.log.warning("FreeJobAlert request failed")
            return jobs

        soup = BeautifulSoup(resp.text, "html.parser")

        tables = []
        for selector in TABLE_SELECTORS:
            tables = soup.select(selector)
            if tables:
                break

        self.log.info("FreeJobAlert found %d candidate tables", len(tables))

        for table in tables:

            category = self._category_for(table)

            rows = table.select("tr")

            for row in rows:
                try:
                    job = self._parse_row(row, category)
                    if job:
                        jobs.append(job)
                except Exception:
                    continue

        self.log.info("FreeJobAlert collected %d jobs", len(jobs))
        return jobs

    def _category_for(self, table) -> Optional[str]:

        heading = table.find_previous(["h2", "h3", "h4"])

        if not heading:
            return None

        text = heading.get_text(strip=True)
        return text or None

    def _parse_row(self, row, category: Optional[str]) -> Optional[Dict]:

        cells = row.find_all(["td"])

        # Header rows use <th>, and empty/placeholder rows won't have the
        # full set of columns — both are safely skipped here.
        if len(cells) < 6:
            return None

        texts = [c.get_text(" ", strip=True) for c in cells]

        row_text = " ".join(texts).lower()
        if any(skip in row_text for skip in SKIP_ROW_TEXT):
            return None

        post_date_raw, board, post_name, qualification, advt_no, last_date_raw = texts[:6]

        if not post_name or len(post_name) < 4:
            return None

        link_tag = row.find("a", href=True)
        if not link_tag:
            return None

        apply_url = urljoin(BASE, link_tag["href"])

        vacancy_match = re.search(r"(\d[\d,]{0,8})\s*posts?", post_name, re.I)
        vacancies = vacancy_match.group(1) if vacancy_match else None

        description_parts = [p for p in (
            f"Qualification: {qualification}" if qualification and qualification != "-" else None,
            f"Category: {category}" if category else None,
        ) if p]

        return {
            "title": post_name,
            "company": board or "FreeJobAlert",
            "department": board or None,
            "vacancies": vacancies,
            "notification_number": advt_no if advt_no not in ("-", "–", "") else None,
            "location": "India",
            "type": "full-time",
            "description": " | ".join(description_parts) if description_parts else post_name,
            "apply_url": apply_url,
            "posted_date": self._to_iso_date(post_date_raw),
            "deadline": self._to_iso_date(last_date_raw),
            "is_government": True,
            "country": "India",
            "category": category,
        }

    def _to_iso_date(self, value: str) -> str:

        if not value:
            return ""

        match = DATE_RE.search(value)
        if not match:
            return ""

        day, month, year = match.groups()

        if len(year) == 2:
            year = f"20{year}"

        try:
            return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
        except ValueError:
            return ""
