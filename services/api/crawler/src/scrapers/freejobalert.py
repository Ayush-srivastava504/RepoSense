# Module: crawler/src/scrapers/freejobalert.py
# Defines class(es): FreeJobAlertScraper
# Defines function(s): _clean
#

import re
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup, Tag
from scrapers.base import BaseScraper
BASE = 'https://www.freejobalert.com'
LISTING_URL = f'{BASE}/latest-notifications/'
REQUEST_TIMEOUT = 30
DATE_RE = re.compile('\\b(\\d{1,2})[./\\-](\\d{1,2})[./\\-](\\d{2,4})\\b')
VACANCY_RE = re.compile('\\b([\\d,]+)\\s*(?:posts?|vacanc(?:y|ies))\\b', re.IGNORECASE)
DETAIL_TEXT_RE = re.compile('^(?:get\\s+details|view\\s+details|details|more\\s+information|read\\s+more|apply\\s+online|notification)$', re.IGNORECASE)
SKIP_TEXT = ('no jobs are currently available', 'advertisement', 'related links', 'important links', 'latest updates', 'click here')
HEADER_WORDS = {'post date', 'recruitment board', 'exam / post name', 'exam/post name', 'post name', 'qualification', 'advt no', 'last date', 'more information'}

class FreeJobAlertScraper(BaseScraper):
    source_name = 'freejobalert'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        seen_urls = set()
        session = requests.Session()
        session.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9'})
        try:
            html = self._fetch_page(session)
            if not html:
                return jobs
            soup = BeautifulSoup(html, 'html.parser')
            tables = soup.find_all('table')
            self.log.info('FreeJobAlert found %d tables', len(tables))
            row_count = 0
            rejected_count = 0
            for table_index, table in enumerate(tables, start=1):
                category = self._category_for(table)
                rows = table.find_all('tr')
                self.log.debug('FreeJobAlert table=%d category=%r rows=%d', table_index, category, len(rows))
                for row in rows:
                    row_count += 1
                    try:
                        job = self._parse_row(row=row, category=category)
                    except Exception as exc:
                        rejected_count += 1
                        self.log.debug('FreeJobAlert row parse error: %s', exc)
                        continue
                    if not job:
                        rejected_count += 1
                        continue
                    apply_url = job.get('apply_url')
                    if not apply_url:
                        continue
                    if apply_url in seen_urls:
                        continue
                    seen_urls.add(apply_url)
                    jobs.append(job)
            self.log.info('FreeJobAlert rows=%d rejected=%d collected=%d', row_count, rejected_count, len(jobs))
        finally:
            session.close()
        self.log.info('FreeJobAlert collected %d jobs', len(jobs))
        return jobs

    def _fetch_page(self, session: requests.Session) -> Optional[str]:
        self.log.info('FreeJobAlert scrape: %s', LISTING_URL)
        try:
            response = session.get(LISTING_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        except requests.RequestException as exc:
            self.log.warning('FreeJobAlert request failed: %s', exc)
            return None
        content_type = response.headers.get('content-type', '').lower()
        self.log.info('FreeJobAlert HTTP %d content-type=%s bytes=%d url=%s', response.status_code, content_type, len(response.content), response.url)
        if response.status_code != 200:
            self.log.warning('FreeJobAlert HTTP %d body=%r', response.status_code, response.text[:300])
            return None
        body = response.text.strip()
        if not body:
            self.log.warning('FreeJobAlert returned empty HTML')
            return None
        if 'html' not in content_type:
            self.log.warning('FreeJobAlert unexpected content-type=%s body=%r', content_type, body[:300])
        return body

    def _category_for(self, table: Tag) -> Optional[str]:
        heading = table.find_previous(['h1', 'h2', 'h3', 'h4', 'h5'])
        if not heading:
            return None
        category = _clean(heading.get_text(' ', strip=True))
        if not category:
            return None
        return category[:250]

    def _parse_row(self, row: Tag, category: Optional[str]) -> Optional[Dict]:
        cells = row.find_all(['td', 'th'], recursive=False)
        if not cells:
            cells = row.find_all(['td', 'th'])
        if len(cells) < 3:
            return None
        texts = [_clean(cell.get_text(' ', strip=True)) for cell in cells]
        texts = [text for text in texts if text]
        if len(texts) < 3:
            return None
        row_text = _clean(' '.join(texts))
        row_text_lower = row_text.lower()
        if any((skip in row_text_lower for skip in SKIP_TEXT)):
            return None
        normalized_cells = {text.lower().strip() for text in texts}
        if len(normalized_cells.intersection(HEADER_WORDS)) >= 2:
            return None
        links = row.find_all('a', href=True)
        detail_link = self._find_job_link(links)
        if not detail_link:
            return None
        apply_url = urljoin(BASE, detail_link.get('href', ''))
        if not self._valid_job_url(apply_url):
            return None
        post_date = self._find_first_date(texts)
        last_date = self._find_last_date(texts)
        board = self._detect_board(texts)
        post_name = self._detect_post_name(cells=cells, texts=texts, detail_link=detail_link, board=board)
        if not post_name:
            return None
        if len(post_name) < 4:
            return None
        if DETAIL_TEXT_RE.match(post_name):
            return None
        qualification = self._detect_qualification(texts=texts, post_name=post_name, board=board)
        advt_no = self._detect_advt_no(texts)
        vacancy_match = VACANCY_RE.search(post_name)
        if not vacancy_match:
            vacancy_match = VACANCY_RE.search(row_text)
        vacancies = vacancy_match.group(1).replace(',', '') if vacancy_match else None
        description_parts = []
        if qualification:
            description_parts.append(f'Qualification: {qualification}')
        if category:
            description_parts.append(f'Category: {category}')
        description = ' | '.join(description_parts) if description_parts else post_name
        return {'title': post_name, 'company': board or 'Government Recruitment', 'department': board or None, 'vacancies': vacancies, 'notification_number': advt_no, 'location': 'India', 'type': self._detect_job_type(post_name), 'salary': '', 'description': description, 'skills': [], 'apply_url': apply_url, 'posted_date': post_date, 'deadline': last_date, 'is_remote': False, 'is_government': True, 'country': 'India', 'category': category}

    def _find_job_link(self, links: List[Tag]) -> Optional[Tag]:
        candidates = []
        for link in links:
            href = _clean(link.get('href'))
            text = _clean(link.get_text(' ', strip=True))
            if not href:
                continue
            if href.startswith(('#', 'javascript:', 'mailto:')):
                continue
            absolute_url = urljoin(BASE, href)
            if not self._valid_job_url(absolute_url):
                continue
            score = 0
            if DETAIL_TEXT_RE.match(text):
                score += 10
            if '/articles/' in absolute_url:
                score += 8
            if 'recruitment' in absolute_url.lower():
                score += 4
            if 'jobs' in absolute_url.lower():
                score += 2
            candidates.append((score, link))
        if not candidates:
            return None
        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]

    def _valid_job_url(self, url: str) -> bool:
        if not url:
            return False
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        if host not in {'freejobalert.com', 'www.freejobalert.com'}:
            return False
        path = parsed.path.lower()
        blocked_paths = ('/latest-notifications', '/government-jobs', '/search-jobs', '/new-updates', '/employment-news', '/about', '/contact', '/privacy', '/terms')
        if any((path.rstrip('/') == blocked.rstrip('/') for blocked in blocked_paths)):
            return False
        return True

    def _detect_board(self, texts: List[str]) -> str:
        for index, text in enumerate(texts):
            if DATE_RE.search(text):
                continue
            if index == len(texts) - 1:
                continue
            if DETAIL_TEXT_RE.match(text):
                continue
            if self._looks_like_qualification(text):
                continue
            if self._looks_like_advt(text):
                continue
            if 2 <= len(text) <= 120:
                return text
        return ''

    def _detect_post_name(self, cells: List[Tag], texts: List[str], detail_link: Tag, board: str) -> str:
        link_text = _clean(detail_link.get_text(' ', strip=True))
        if link_text and (not DETAIL_TEXT_RE.match(link_text)) and (len(link_text) >= 4):
            return link_text
        for text in texts:
            if text == board:
                continue
            if DATE_RE.fullmatch(text):
                continue
            if DETAIL_TEXT_RE.match(text):
                continue
            if self._looks_like_qualification(text):
                continue
            if self._looks_like_advt(text):
                continue
            if len(text) >= 4:
                return text
        return ''

    def _detect_qualification(self, texts: List[str], post_name: str, board: str) -> str:
        for text in texts:
            if text in {post_name, board}:
                continue
            if DATE_RE.search(text):
                continue
            if DETAIL_TEXT_RE.match(text):
                continue
            if self._looks_like_qualification(text):
                return text
        return ''

    def _looks_like_qualification(self, text: str) -> bool:
        value = text.lower()
        qualification_words = ('10th', '12th', 'degree', 'graduate', 'graduation', 'diploma', 'b.tech', 'b.e', 'm.tech', 'm.e', 'b.sc', 'm.sc', 'b.com', 'm.com', 'b.a', 'm.a', 'mba', 'mbbs', 'ph.d', 'phd', 'iti', 'llb', 'll.m', 'nursing', 'any degree', 'post graduate')
        return any((word in value for word in qualification_words))

    def _looks_like_advt(self, text: str) -> bool:
        value = text.lower()
        if value in {'-', '–', '—'}:
            return False
        return bool(re.search('\\b(?:advt|advertisement|notification|recruitment)\\s*(?:no\\.?|number)?', value, re.IGNORECASE) or re.fullmatch('[A-Z0-9][A-Z0-9./\\-]{2,30}', text, re.IGNORECASE))

    def _detect_advt_no(self, texts: List[str]) -> Optional[str]:
        for text in texts:
            if self._looks_like_advt(text):
                if DATE_RE.fullmatch(text):
                    continue
                return text
        return None

    def _find_first_date(self, texts: List[str]) -> str:
        for text in texts:
            value = self._to_iso_date(text)
            if value:
                return value
        return ''

    def _find_last_date(self, texts: List[str]) -> str:
        dates = []
        for text in texts:
            value = self._to_iso_date(text)
            if value:
                dates.append(value)
        if len(dates) >= 2:
            return dates[-1]
        return ''

    def _detect_job_type(self, title: str) -> str:
        value = title.lower()
        if 'intern' in value:
            return 'internship'
        if 'apprentice' in value:
            return 'apprenticeship'
        if 'contract' in value:
            return 'contract'
        return 'full-time'

    def _to_iso_date(self, value: str) -> str:
        if not value:
            return ''
        match = DATE_RE.search(value)
        if not match:
            return ''
        day, month, year = match.groups()
        if len(year) == 2:
            year = f'20{year}'
        try:
            parsed = datetime(year=int(year), month=int(month), day=int(day))
        except ValueError:
            return ''
        return parsed.strftime('%Y-%m-%d')

def _clean(value) -> str:
    return re.sub('\\s+', ' ', str(value or '')).strip()
