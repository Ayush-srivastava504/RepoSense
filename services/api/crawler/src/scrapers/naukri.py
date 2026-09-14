# Naukri.com — India's largest job board. Unlike the ATS adapters above,
# this is a "board" scraper (one big search index, not per-company boards)
# — same category as linkedin.py, weworkremotely.py, remoteok.py, etc.
# FresherFlow's board-adapter category (see packages/plugins/src/adapters/
# board/naukri) hits the same public search-results HTML with axios +
# cheerio; this ports that approach to requests + BeautifulSoup, run
# through Naukri's public search URL rather than any private/authenticated
# API. No login, no session cookie is used or required.
#
# GET https://www.naukri.com/{keyword-slug}-jobs-in-{location-slug}
# e.g. https://www.naukri.com/software-engineer-jobs-in-bangalore
#
# Naukri's search results are rendered server-side in a `<script
# id="__NEXT_DATA__">` JSON blob (Next.js), which is far more stable to
# parse than the visible DOM (class names there are minified/versioned
# and rotate often) — this scraper reads that blob first and only falls
# back to CSS-selector scraping of the visible cards if the blob isn't
# found, same defensive-fallback shape FresherFlow's dorker.ts uses for
# HTML that may or may not carry the JSON island it expects.

import json
import re
import time
from typing import Dict, List, Optional
from urllib.parse import quote

from bs4 import BeautifulSoup
from scrapers.ats_common import clean
from scrapers.base import BaseScraper
from utils import make_session

BASE = 'https://www.naukri.com'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
}


def _slugify(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


class NaukriScraper(BaseScraper):
    source_name = 'naukri'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        session = make_session()
        jobs: List[Dict] = []
        seen_urls = set()
        # Naukri's catalog is huge; keep this bounded the same way
        # linkedin.py bounds its keyword x location matrix, rather than
        # crawling every keyword/location combination on every run.
        bounded_keywords = keywords[:8] or ['software engineer', 'fresher']
        bounded_locations = (locations[:4] or ['India'])
        try:
            for keyword in bounded_keywords:
                for location in bounded_locations:
                    try:
                        batch = self._search(session, keyword, location, max_pages=min(max_pages, 2))
                    except Exception as exc:
                        self.log.warning('Naukri search failed for %r/%r: %s', keyword, location, exc)
                        continue
                    for job in batch:
                        url = job.get('apply_url', '')
                        if url and url in seen_urls:
                            continue
                        if url:
                            seen_urls.add(url)
                        jobs.append(job)
                    time.sleep(1.0)
        finally:
            session.close()
        self.log.info('Naukri collected %d jobs', len(jobs))
        return jobs

    def _search(self, session, keyword: str, location: str, max_pages: int) -> List[Dict]:
        results: List[Dict] = []
        keyword_slug = _slugify(keyword)
        location_slug = _slugify(location)
        for page_num in range(1, max_pages + 1):
            url = f'{BASE}/{keyword_slug}-jobs-in-{location_slug}' + (f'-{page_num}' if page_num > 1 else '')
            try:
                response = session.get(url, headers=HEADERS, timeout=30)
            except Exception as exc:
                self.log.warning('Naukri request failed %s: %s', url, exc)
                continue
            if response.status_code != 200:
                self.log.info('Naukri HTTP %d for %s', response.status_code, url)
                continue
            page_jobs = self._parse_next_data(response.text) or self._parse_html_cards(response.text)
            if not page_jobs:
                break
            results.extend(page_jobs)
        return results

    def _parse_next_data(self, html: str) -> Optional[List[Dict]]:
        match = re.search(
            r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL
        )
        if not match:
            return None
        try:
            payload = json.loads(match.group(1))
        except (ValueError, json.JSONDecodeError):
            return None
        # The job list lives at a deeply-nested, version-dependent path
        # inside Next.js's page props. Search breadth-first for the first
        # list of dict entries that look like job records (has a title-ish
        # key) rather than hardcoding the exact path, since that path has
        # historically moved between Naukri deploys.
        found = self._find_job_list(payload)
        if not found:
            return None
        out = []
        for entry in found:
            job = self._entry_to_job(entry)
            if job:
                out.append(job)
        return out

    def _find_job_list(self, node, depth: int = 0) -> Optional[List[Dict]]:
        if depth > 8:
            return None
        if isinstance(node, list) and node and isinstance(node[0], dict):
            keys = set(node[0].keys())
            if keys & {'title', 'jobTitle', 'jdURL', 'jdUrl'}:
                return node
        if isinstance(node, dict):
            for value in node.values():
                found = self._find_job_list(value, depth + 1)
                if found:
                    return found
        elif isinstance(node, list):
            for value in node:
                found = self._find_job_list(value, depth + 1)
                if found:
                    return found
        return None

    def _entry_to_job(self, entry: Dict) -> Optional[Dict]:
        if not isinstance(entry, dict):
            return None
        title = clean(entry.get('title') or entry.get('jobTitle') or '')
        company = clean(entry.get('companyName') or entry.get('company') or '')
        if not title or not company:
            return None
        location = clean(entry.get('placeholders', {}).get('location', '') if isinstance(entry.get('placeholders'), dict) else entry.get('location', ''))
        apply_path = entry.get('jdURL') or entry.get('jdUrl') or entry.get('staticUrl') or ''
        apply_url = apply_path if apply_path.startswith('http') else f'{BASE}{apply_path}' if apply_path else ''
        if not apply_url:
            return None
        experience = clean(entry.get('placeholders', {}).get('experience', '') if isinstance(entry.get('placeholders'), dict) else '')
        return {
            'title': title,
            'company': company,
            'location': location or 'India',
            'type': 'internship' if 'intern' in title.lower() else 'full-time',
            'description': clean(entry.get('jobDescription', '')),
            'skills': [clean(s) for s in (entry.get('tagsAndSkills', '') or '').split(',') if s.strip()],
            'apply_url': apply_url,
            'posted_date': str(entry.get('createdDate', '') or ''),
            'is_remote': 'remote' in (location or '').lower(),
            'experience_required': experience,
            'country': 'India',
            'source': self.source_name,
        }

    def _parse_html_cards(self, html: str) -> List[Dict]:
        # Fallback path if the __NEXT_DATA__ blob isn't present (server
        # rendering variant, A/B test, or markup change). Best-effort only
        # — Naukri's visible-DOM class names are minified/versioned and
        # rotate across deploys, same caveat linkedin.py documents for
        # its own selector fallback chain.
        soup = BeautifulSoup(html, 'html.parser')
        cards = soup.select('.jobTuple, article.jobTuple, [data-job-id]')
        out = []
        for card in cards:
            title_el = card.select_one('.title, a.title')
            company_el = card.select_one('.comp-name, .companyName, a.comp-name')
            location_el = card.select_one('.locWdth, .loc')
            link_el = title_el if title_el and title_el.name == 'a' else card.select_one('a.title')
            title = clean(title_el.get_text(strip=True)) if title_el else ''
            company = clean(company_el.get_text(strip=True)) if company_el else ''
            if not title or not company:
                continue
            href = link_el.get('href') if link_el else ''
            out.append({
                'title': title,
                'company': company,
                'location': clean(location_el.get_text(strip=True)) if location_el else 'India',
                'type': 'internship' if 'intern' in title.lower() else 'full-time',
                'description': clean(card.get_text(' ', strip=True))[:2000],
                'skills': [],
                'apply_url': href if (href or '').startswith('http') else (f'{BASE}{href}' if href else ''),
                'posted_date': '',
                'is_remote': False,
                'country': 'India',
                'source': self.source_name,
            })
        return [j for j in out if j.get('apply_url')]
