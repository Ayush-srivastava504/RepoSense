# Module: crawler/src/scrapers/cutshort.py
# Defines class(es): CutshortScraper
# Defines function(s): _clean
#

import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
from scrapers.base import BaseScraper
BASE = 'https://cutshort.io'
CATEGORY_SLUGS = ['internship-jobs', 'fullstack-developer-jobs', 'backend-developer-jobs', 'frontend-developer-jobs', 'datascience-jobs', 'devops-jobs']
REQUEST_TIMEOUT = 20

class CutshortScraper(BaseScraper):
    source_name = 'cutshort'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        seen_urls = set()
        session = requests.Session()
        session.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Cache-Control': 'no-cache'})
        for slug in CATEGORY_SLUGS:
            try:
                html = self._fetch_category(session, slug)
                if not html:
                    continue
                if os.getenv('SCRAPER_DEBUG'):
                    with open(f'cutshort_debug_{slug}.html', 'w', encoding='utf-8') as f:
                        f.write(html)
                soup = BeautifulSoup(html, 'html.parser')
                cards = self._find_cards(soup)
                self.log.info('Cutshort [%s] found %d cards', slug, len(cards))
                for idx, card in enumerate(cards):
                    next_h2 = cards[idx + 1] if idx + 1 < len(cards) else None
                    try:
                        job = self._parse_card(card, next_h2)
                        if not job:
                            continue
                        apply_url = job.get('apply_url')
                        if not apply_url or apply_url in seen_urls:
                            continue
                        seen_urls.add(apply_url)
                        jobs.append(job)
                    except Exception as e:
                        self.log.debug('Cutshort card parse failed: %s', str(e))
            except Exception as e:
                self.log.warning('Cutshort failed [%s]: %s', slug, str(e))
            time.sleep(random.uniform(1, 2))
        session.close()
        self.log.info('Collected %d jobs from cutshort', len(jobs))
        return jobs

    def _fetch_category(self, session: requests.Session, slug: str) -> str:
        url = f'{BASE}/jobs/{slug}'
        self.log.info('Cutshort scrape: %s', url)
        started = time.monotonic()
        response = session.get(url, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        elapsed = time.monotonic() - started
        self.log.info('Cutshort [%s] HTTP %d in %.2fs', slug, response.status_code, elapsed)
        response.raise_for_status()
        if not response.text:
            self.log.warning('Cutshort [%s] returned empty HTML', slug)
            return ''
        return response.text

    # NOTE: previously this walked up to 4 ancestor levels from each <h2>
    # looking for a container that also contains an <h3>. On pages where
    # several job cards share a common ancestor (e.g. the whole list is
    # one wrapper <div>, or cards are only lightly nested), that walk
    # could land on the SAME wide ancestor for multiple different job
    # postings. _parse_card then did card.find('h2') / card.find('h3'),
    # which returns the *first* match in that shared container — so
    # every card after the first silently got the first job's title and
    # company. Fixed by never re-searching a container: each card now
    # carries the exact <h2> that matched it, and we scope the company
    # lookup + description text to the DOM range between this <h2> and
    # the next one (or end of document for the last card), so unrelated
    # cards can no longer bleed into each other regardless of nesting.
    def _find_cards(self, soup: BeautifulSoup) -> List:
        h2s = []
        seen = set()
        for h2 in soup.find_all('h2'):
            title_link = h2.find('a', href=True)
            if not title_link:
                continue
            title = title_link.get_text(' ', strip=True)
            if not title:
                continue
            href = title_link.get('href', '')
            if not href or href in seen:
                continue
            seen.add(href)
            h2s.append(h2)
        return h2s

    def _parse_card(self, h2, next_h2=None) -> Optional[Dict]:
        title_link = h2.find('a', href=True)
        if not title_link:
            return None
        title = _clean(title_link.get_text(' ', strip=True))
        if not title:
            return None

        job = self._empty_job()
        job['title'] = title

        # Walk forward in document order from this h2, stopping the
        # instant we reach the next card's h2 (or after a sane element
        # cap, for the last card on the page where there is no next_h2).
        h3 = None
        text_parts = []
        for i, el in enumerate(h2.next_elements):
            if next_h2 is not None and el is next_h2:
                break
            if i > 800:  # bound work for the last card / malformed pages
                break
            if getattr(el, 'name', None) == 'h3' and h3 is None:
                h3 = el
            if isinstance(el, str):
                stripped = el.strip()
                if stripped:
                    text_parts.append(stripped)

        if h3 is not None:
            company_link = h3.find('a') if hasattr(h3, 'find') else None
            job['company'] = _clean(company_link.get_text(' ', strip=True)) if company_link else _clean(h3.get_text(' ', strip=True))
        else:
            job['company'] = ''

        text_blob = _clean(' '.join(text_parts))
        is_remote = bool(re.search('\\bremote\\b', text_blob, re.IGNORECASE))
        salary_match = re.search('₹[\\d.,LKlakhs\\s\\-/yrmo]+', text_blob, re.IGNORECASE)
        href = title_link.get('href', '')
        job['location'] = 'Remote' if is_remote else ''
        job['salary'] = salary_match.group(0).strip() if salary_match else ''
        job['description'] = text_blob[:1000]
        job['skills'] = []
        job['type'] = 'internship' if 'intern' in title.lower() else 'full-time'
        job['is_remote'] = is_remote
        job['posted_date'] = ''
        job['apply_url'] = href if href.startswith('http') else urljoin(BASE, href)
        return job

def _clean(text) -> str:
    return re.sub('\\s+', ' ', str(text or '')).strip()
