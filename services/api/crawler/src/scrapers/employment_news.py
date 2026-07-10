"""
Employment News (Rozgar Samachar) — https://employmentnews.gov.in

Government recruitment weekly, published by the Ministry of Information &
Broadcasting. Its listings already expose recruitment-oriented fields —
department/office, post/notification title, and number of vacancies — which
is exactly the shape government-job cards need, so this is the first
government scraper we run.

The site is a fairly plain, server-rendered HTML site, so no browser is
needed — requests + BeautifulSoup is enough. Selectors are written
defensively (several candidate selectors tried in order) since gov sites
change markup without notice; when nothing matches we log and return an
empty batch rather than raising, matching this repo's convention for the
other scrapers.
"""

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from utils import safe_get


BASE = "https://employmentnews.gov.in"
LISTING_URLS = [
    f"{BASE}/newenglishweb/RecruitmentList.aspx",
    f"{BASE}/newenglishweb/Employmentnews.aspx",
]

VACANCY_RE = re.compile(r"(\d[\d,]{1,8})\s*(?:posts?|vacanc\w*)", re.I)
NOTIFICATION_RE = re.compile(
    r"(?:notification|advt\.?|advertisement)\s*(?:no\.?|number)?\s*[:\-]?\s*"
    r"([A-Za-z0-9\/\-\.]{3,40})",
    re.I,
)

CARD_SELECTORS = [
    ".recruitment-item",
    ".notification-list li",
    "table tr",
    ".job-listing",
]


class EmploymentNewsScraper(BaseScraper):

    source_name = "employment_news"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        for url in LISTING_URLS:

            resp = safe_get(
                self.session,
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/124.0.0.0 Safari/537.36"
                    ),
                },
                domain_key="employment_news",
            )

            if resp is None:
                self.log.warning("Employment News request failed: %s", url)
                continue

            soup = BeautifulSoup(resp.text, "html.parser")

            cards = []
            for selector in CARD_SELECTORS:
                cards = soup.select(selector)
                if cards:
                    break

            self.log.info("Employment News found %d candidate rows at %s", len(cards), url)

            for card in cards:
                try:
                    job = self._parse_card(card, url)
                    if job:
                        jobs.append(job)
                except Exception:
                    continue

        self.log.info("Employment News collected %d jobs", len(jobs))
        return jobs

    def _parse_card(self, card, page_url: str) -> Optional[Dict]:
        link_tag = card.find("a", href=True)
        if not link_tag:
            return None

        title_text = link_tag.get_text(strip=True)
        if not title_text or len(title_text) < 6:
            return None

        apply_url = urljoin(page_url, link_tag["href"])

        # Employment News listings are typically "Department — Post Title".
        # Fall back to using the whole line as the title when there's no
        # separator, and department stays unknown rather than guessed.
        department = None
        title = title_text
        for sep in (" — ", " - ", ":"):
            if sep in title_text:
                left, right = title_text.split(sep, 1)
                if len(left.strip()) < 60:
                    department = left.strip()
                    title = right.strip()
                break

        row_text = card.get_text(" ", strip=True)

        vacancy_match = VACANCY_RE.search(row_text)
        vacancies = vacancy_match.group(1) if vacancy_match else None

        notif_match = NOTIFICATION_RE.search(row_text)
        notification_number = notif_match.group(1) if notif_match else None

        return {
            "title": title,
            "company": department or "Government of India",
            "department": department,
            "vacancies": vacancies,
            "notification_number": notification_number,
            "location": "India",
            "type": "full-time",
            "description": row_text,
            "apply_url": apply_url,
            "is_government": True,
            "country": "India",
        }
