"""
Employment News (Rozgar Samachar) — https://employmentnews.gov.in

Government recruitment weekly. Server-rendered HTML — no browser needed.
This scraper logs verbosely because the origin server is known to return
intermittent 5xx errors; that needs to be visible and distinguishable from
a genuine markup/selector break.
"""

import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

from scrapers.base import BaseScraper


BASE = "https://employmentnews.gov.in"
LISTING_URLS = [
    f"{BASE}/newenglishweb/RecruitmentList.aspx",
    f"{BASE}/newenglishweb/Employmentnews.aspx",
]

REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BACKOFF_SEC = 5

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

        session = requests.Session()

        session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/138.0.0.0 Safari/537.36"
            ),
            "Accept": (
                "text/html,application/xhtml+xml,"
                "application/xml;q=0.9,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        })

        try:
            for url in LISTING_URLS:

                html = self._fetch_with_retry(session, url)

                if html is None:
                    continue

                soup = BeautifulSoup(html, "html.parser")

                cards: List[Tag] = []
                matched_selector = None

                for selector in CARD_SELECTORS:
                    cards = soup.select(selector)
                    if cards:
                        matched_selector = selector
                        break

                self.log.info(
                    "Employment News url=%s selector=%r found %d rows",
                    url,
                    matched_selector,
                    len(cards),
                )

                if not cards:
                    self.log.warning(
                        "Employment News: no selector matched at %s — "
                        "page markup may have changed",
                        url,
                    )
                    continue

                for card in cards:
                    try:
                        job = self._parse_card(card, url)
                    except Exception as exc:
                        self.log.debug(
                            "Employment News row parse failed: %s", exc
                        )
                        continue

                    if job:
                        jobs.append(job)

        finally:
            session.close()

        self.log.info("Employment News collected %d jobs", len(jobs))
        return jobs

    def _fetch_with_retry(
        self,
        session: requests.Session,
        url: str,
    ) -> Optional[str]:

        for attempt in range(1, MAX_RETRIES + 1):

            try:
                response = session.get(
                    url,
                    timeout=REQUEST_TIMEOUT,
                    allow_redirects=True,
                )

            except requests.RequestException as exc:
                self.log.warning(
                    "Employment News request failed (attempt %d/%d) "
                    "url=%s: %s",
                    attempt,
                    MAX_RETRIES,
                    url,
                    exc,
                )
                time.sleep(RETRY_BACKOFF_SEC * attempt)
                continue

            content_type = response.headers.get("content-type", "").lower()

            self.log.info(
                "Employment News HTTP %d (attempt %d/%d) "
                "content-type=%s bytes=%d url=%s",
                response.status_code,
                attempt,
                MAX_RETRIES,
                content_type,
                len(response.content),
                response.url,
            )

            if response.status_code == 200:
                body = response.text.strip()
                if not body:
                    self.log.warning(
                        "Employment News returned empty body url=%s", url
                    )
                    return None
                return body

            if response.status_code >= 500:
                self.log.warning(
                    "Employment News server error %d (attempt %d/%d) "
                    "url=%s body=%r",
                    response.status_code,
                    attempt,
                    MAX_RETRIES,
                    url,
                    response.text[:300],
                )
                time.sleep(RETRY_BACKOFF_SEC * attempt)
                continue

            # 4xx or other unexpected status — retrying won't help.
            self.log.warning(
                "Employment News non-retryable HTTP %d url=%s body=%r",
                response.status_code,
                url,
                response.text[:300],
            )
            return None

        self.log.warning(
            "Employment News exhausted %d retries for url=%s — "
            "server likely down/500ing persistently",
            MAX_RETRIES,
            url,
        )
        return None

    def _parse_card(self, card: Tag, page_url: str) -> Optional[Dict]:

        link_tag = card.find("a", href=True)
        if not link_tag:
            return None

        title_text = _clean(link_tag.get_text(" ", strip=True))
        if not title_text or len(title_text) < 6:
            return None

        apply_url = urljoin(page_url, link_tag["href"])

        department = None
        title = title_text
        for sep in (" — ", " - ", ":"):
            if sep in title_text:
                left, right = title_text.split(sep, 1)
                if len(left.strip()) < 60:
                    department = left.strip()
                    title = right.strip()
                break

        row_text = _clean(card.get_text(" ", strip=True))

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
            "is_remote": False,
            "country": "India",
        }


def _clean(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()