# Dorker — dynamic ATS board discovery via search-engine dork queries,
# ported from FresherFlow's packages/pipeline/src/core/dork-executor.ts
# (see that file's header: it runs `site:boards.greenhouse.io "intern"`
# style queries against Bing as the primary source, DuckDuckGo as a
# Playwright-rendered fallback).
#
# Every other ATS scraper in this package (greenhouse.py, lever.py, ...)
# only ever crawls a hardcoded ATS_COMPANIES token list, which config.py
# itself flags as a stopgap:
#
#   "The real fix (see FresherFlow's dorker.ts) is dynamic board
#   discovery via search rather than a static company list — worth
#   porting over as a follow-up rather than re-patching this list again
#   next quarter."
#
# This scraper is that follow-up. It runs a small set of dork queries
# against Bing's HTML search results (no API key required, same as
# FresherFlow's primary path), extracts ATS board tokens from the result
# URLs (e.g. "boards.greenhouse.io/acme" -> token "acme"), skips tokens
# already present in ATS_COMPANIES (those are already crawled by their
# dedicated scraper every run — no need to re-discover them), and fetches
# jobs from every newly-discovered board using the same public JSON APIs
# the dedicated per-provider scrapers use. Jobs are tagged
# source_name='dorker' so they're visibly attributable in the Source
# filter (see lib/facets.ts SOURCE_LABELS -> 'Web Discovery') rather than
# silently merged into e.g. 'greenhouse'.
#
# Bing search HTML is not a stable, versioned API — this is inherently a
# best-effort scraper (same caveat FresherFlow's own dork-executor.ts
# documents for its Bing/DuckDuckGo fallback chain), wrapped defensively
# so a layout change degrades to "found nothing this run" rather than
# crashing the pipeline.

import random
import re
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote

from bs4 import BeautifulSoup
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

BING_SEARCH_URL = 'https://www.bing.com/search'
BING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html',
}

# (provider key, board-URL regex, dork query template). Query templates
# target intern/fresher/graduate postings specifically — the same
# audience skew FresherFlow's HEAVY_DORK_QUERIES applies — rather than
# generic "jobs", to keep discovered boards relevant to this product.
PROVIDERS: List[Tuple[str, str, List[str]]] = [
    (
        'greenhouse',
        r'boards\.greenhouse\.io/([a-zA-Z0-9_-]+)',
        [
            'site:boards.greenhouse.io "intern" India',
            'site:boards.greenhouse.io "graduate" "2026"',
            'site:boards.greenhouse.io "new grad" software engineer',
        ],
    ),
    (
        'lever',
        r'jobs\.lever\.co/([a-zA-Z0-9_-]+)',
        [
            'site:jobs.lever.co "intern" India',
            'site:jobs.lever.co "new grad" engineer',
        ],
    ),
    (
        'ashby',
        r'jobs\.ashbyhq\.com/([a-zA-Z0-9_-]+)',
        [
            'site:jobs.ashbyhq.com "intern"',
            'site:jobs.ashbyhq.com "new grad" OR "university grad"',
        ],
    ),
    (
        'smartrecruiters',
        r'jobs\.smartrecruiters\.com/([a-zA-Z0-9_-]+)',
        [
            'site:jobs.smartrecruiters.com "intern" India',
        ],
    ),
    (
        'workable',
        r'apply\.workable\.com/([a-zA-Z0-9_-]+)',
        [
            'site:apply.workable.com "intern"',
        ],
    ),
]

FETCHERS = {
    'greenhouse': ('https://boards-api.greenhouse.io/v1/boards/{token}/jobs', {'content': 'true'}, 'jobs'),
    'lever': ('https://api.lever.co/v0/postings/{token}', {'mode': 'json'}, None),
    'ashby': ('https://api.ashbyhq.com/posting-api/job-board/{token}', {'includeCompensation': 'true'}, 'jobs'),
}


class DorkerScraper(BaseScraper):
    source_name = 'dorker'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        session = make_session()
        jobs: List[Dict] = []
        try:
            discovered = self._discover_tokens(session)
            self.log.info('Dorker discovered %d new board(s) across %d provider(s)', sum(len(v) for v in discovered.values()), len(discovered))
            for provider, tokens in discovered.items():
                for token in tokens:
                    try:
                        jobs.extend(self._fetch_board(session, provider, token))
                    except Exception as exc:
                        self.log.warning('Dorker fetch failed for %s/%s: %s', provider, token, exc)
                    time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Dorker collected %d jobs from newly-discovered boards', len(jobs))
        return jobs

    def _discover_tokens(self, session) -> Dict[str, List[str]]:
        discovered: Dict[str, List[str]] = {}
        for provider, url_pattern, queries in PROVIDERS:
            known = {t.lower() for t in ATS_COMPANIES.get(provider, [])}
            found: set = set()
            for query in queries:
                try:
                    tokens = self._search_bing(session, query, url_pattern)
                except Exception as exc:
                    self.log.warning('Dorker Bing search failed for %r: %s', query, exc)
                    continue
                found.update(t for t in tokens if t.lower() not in known)
                time.sleep(random.uniform(1.5, 3.0))
            if found:
                discovered[provider] = sorted(found)[:25]  # cap per-provider per-run
        return discovered

    def _search_bing(self, session, query: str, url_pattern: str) -> List[str]:
        try:
            response = session.get(
                BING_SEARCH_URL,
                params={'q': query, 'count': '30'},
                headers=BING_HEADERS,
                timeout=20,
            )
        except Exception as exc:
            self.log.warning('Bing request failed for %r: %s', query, exc)
            return []
        if response.status_code != 200:
            self.log.info('Bing HTTP %d for query %r', response.status_code, query)
            return []
        soup = BeautifulSoup(response.text, 'html.parser')
        tokens: set = set()
        pattern = re.compile(url_pattern)
        for link in soup.select('li.b_algo h2 a, a'):
            href = link.get('href') or ''
            match = pattern.search(href)
            if match:
                tokens.add(match.group(1).lower())
        return list(tokens)

    def _fetch_board(self, session, provider: str, token: str) -> List[Dict]:
        if provider not in FETCHERS:
            return []
        url_template, params, entries_key = FETCHERS[provider]
        data = fetch_json(session, url_template.format(token=token), params=params)
        if not data:
            return []
        entries = data.get(entries_key) if entries_key else data
        if not isinstance(entries, list):
            return []
        company_name = token.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            job = self._entry_to_job(provider, token, company_name, entry)
            if job:
                out.append(job)
        if out:
            self.log.info('Dorker discovered board %s/%s -> %d jobs', provider, token, len(out))
        return out

    def _entry_to_job(self, provider: str, token: str, company_name: str, entry: Dict) -> Optional[Dict]:
        if provider == 'greenhouse':
            location_obj = entry.get('location') or {}
            location = location_obj.get('name', '') if isinstance(location_obj, dict) else ''
            return build_job(
                title=entry.get('title', ''), company=company_name, location=location,
                description=entry.get('content', ''), apply_url=entry.get('absolute_url', ''),
                posted_date=str(entry.get('updated_at', '') or ''), source=self.source_name,
            )
        if provider == 'lever':
            categories = entry.get('categories') or {}
            location = categories.get('location', '') if isinstance(categories, dict) else ''
            return build_job(
                title=entry.get('text', ''), company=company_name, location=location,
                description=entry.get('descriptionPlain', '') or entry.get('description', ''),
                apply_url=entry.get('hostedUrl', '') or entry.get('applyUrl', ''),
                posted_date=str(entry.get('createdAt', '') or ''), source=self.source_name,
            )
        if provider == 'ashby':
            location = entry.get('location', '') or entry.get('locationName', '')
            return build_job(
                title=entry.get('title', ''), company=company_name, location=location,
                description=entry.get('descriptionPlain', '') or entry.get('description', ''),
                apply_url=entry.get('jobUrl', '') or entry.get('applyUrl', ''),
                is_remote=bool(entry.get('isRemote', False)) or None,
                posted_date=str(entry.get('publishedAt', '') or ''), source=self.source_name,
            )
        return None
