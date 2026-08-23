# Generic "smart" board scraper.
# Greenhouse/Lever/Ashby/SmartRecruiters/Workable (see greenhouse.py,
# lever.py, ashby.py, smartrecruiters.py, workable.py) each have a clean,
# documented, unauthenticated JSON API — one shared fetch/parse module

import json
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from config import GENERIC_BOARDS
from scrapers.ats_common import build_job, clean, dedupe
from scrapers.base import BaseScraper
WHITESPACE_RE = re.compile('\\s+')
JOB_HREF_KEYWORDS = ('/job/', '/jobs/', '/career/', '/careers/', '/opening/', '/openings/', '/position/', '/positions/', '/vacancy/', '/vacancies/', '/req/', 'requisition', 'jobid=', 'job_id=', 'job-id=')
JOB_TITLE_KEYWORDS = frozenset(('intern', 'internship', 'trainee', 'engineer', 'developer', 'analyst', 'manager', 'associate', 'specialist', 'consultant', 'executive', 'lead', 'designer', 'scientist', 'architect', 'officer', 'coordinator', 'graduate', 'fresher', 'researcher'))

class GenericBoardsScraper(BaseScraper):
    source_name = 'generic_boards'
    uses_browser = True

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        boards = GENERIC_BOARDS
        jobs: List[Dict] = []
        for board in boards:
            name = board.get('name', board.get('url', 'unknown'))
            try:
                batch = self._scrape_board(board)
                self.log.info('%s -> %d jobs', name, len(batch))
                jobs.extend(batch)
            except Exception as exc:
                self.log.error("Generic board '%s' failed: %s", name, exc, exc_info=True)
        jobs = dedupe(jobs)
        self.log.info('Generic boards collected %d jobs across %d boards', len(jobs), len(boards))
        return jobs

    def _scrape_board(self, board: Dict) -> List[Dict]:
        url = board['url']
        source_tag = board.get('source_tag', self.source_name)
        board_name = board.get('name', source_tag)
        company_hint = board.get('company_hint', '')
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
        soup = BeautifulSoup(html, 'html.parser')
        page_company = self._guess_page_company(soup) or board_name
        jobs = self._extract_jsonld(soup, url, source_tag, company_hint, page_company)
        if not jobs:
            jobs = self._extract_heuristic(soup, url, source_tag, company_hint, page_company)
        return jobs

    @staticmethod
    def _guess_page_company(soup) -> str:
        for attrs in ({'property': 'og:site_name'}, {'name': 'application-name'}, {'name': 'author'}):
            tag = soup.find('meta', attrs=attrs)
            if tag and tag.get('content'):
                value = clean(tag['content'])
                if value:
                    return value
        return ''

    def _extract_jsonld(self, soup, base_url: str, source_tag: str, company_hint: str, page_company: str='') -> List[Dict]:
        out = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                payload = json.loads(script.string or '')
            except Exception:
                continue
            items = []
            if isinstance(payload, list):
                items.extend(payload)
            elif isinstance(payload, dict):
                items.append(payload)
                graph = payload.get('@graph')
                if isinstance(graph, list):
                    items.extend(graph)
            for item in items:
                if not isinstance(item, dict) or item.get('@type') != 'JobPosting':
                    continue
                title = clean(item.get('title', ''))
                if not title:
                    continue
                org = item.get('hiringOrganization')
                company = ''
                if isinstance(org, dict):
                    company = clean(org.get('name', ''))
                company = company or company_hint or page_company
                job_location = item.get('jobLocation')
                if isinstance(job_location, list) and job_location:
                    job_location = job_location[0]
                location = ''
                if isinstance(job_location, dict):
                    address = job_location.get('address', {})
                    if isinstance(address, dict):
                        location = clean(address.get('addressLocality', '') or address.get('addressRegion', ''))
                apply_url = clean(item.get('url', '')) or base_url
                job = build_job(title=title, company=company, location=location, description=item.get('description', ''), apply_url=apply_url, posted_date=item.get('datePosted', ''), source=source_tag)
                if job:
                    out.append(job)
        return out

    def _extract_heuristic(self, soup, base_url: str, source_tag: str, company_hint: str, page_company: str='') -> List[Dict]:
        out = []
        seen_titles = set()
        for link in soup.select('a[href]'):
            text = clean(link.get_text(' ', strip=True))
            href = link.get('href', '')
            if not text or len(text) < 4 or len(text) > 120:
                continue
            lowered = text.lower()
            if lowered in seen_titles:
                continue
            if not any((kw in lowered for kw in JOB_TITLE_KEYWORDS)):
                continue
            href_lower = href.lower()
            if not any((kw in href_lower for kw in JOB_HREF_KEYWORDS)):
                continue
            seen_titles.add(lowered)
            container = link.find_parent(['li', 'tr', 'div', 'article'])
            description = clean(container.get_text(' ', strip=True)) if container else text
            listing_company = ''
            if container:
                company_el = container.select_one('[class*="company"], [class*="employer"], [class*="org"]')
                if company_el:
                    listing_company = clean(company_el.get_text(' ', strip=True))
            job = build_job(title=text, company=listing_company or company_hint or page_company, location='', description=description, apply_url=urljoin(base_url, href), source=source_tag)
            if job:
                out.append(job)
        return out
