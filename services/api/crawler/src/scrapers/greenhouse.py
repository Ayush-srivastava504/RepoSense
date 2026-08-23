# Greenhouse job boards — public, unauthenticated JSON API:
# GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
# `token` is the company's Greenhouse board slug (e.g. "stripe" for
# boards.greenhouse.io/stripe). Configure the list of tokens to crawl in

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session
API_URL = 'https://boards-api.greenhouse.io/v1/boards/{token}/jobs'

class GreenhouseScraper(BaseScraper):
    source_name = 'greenhouse'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        tokens = ATS_COMPANIES.get('greenhouse', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for token in tokens:
                try:
                    jobs.extend(self._fetch_board(session, token))
                except Exception as exc:
                    self.log.error("Greenhouse board '%s' failed: %s", token, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Greenhouse collected %d jobs across %d boards', len(jobs), len(tokens))
        return jobs

    def _fetch_board(self, session, token: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(token=token), params={'content': 'true'})
        if not data:
            return []
        entries = data.get('jobs')
        if not isinstance(entries, list):
            return []
        company_name = token.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            location = ''
            loc_obj = entry.get('location')
            if isinstance(loc_obj, dict):
                location = loc_obj.get('name', '')
            job = build_job(title=entry.get('title', ''), company=company_name, location=location, description=entry.get('content', ''), apply_url=entry.get('absolute_url', ''), posted_date=str(entry.get('updated_at', '') or ''), source=self.source_name)
            if job:
                out.append(job)
        self.log.info('Greenhouse[%s] -> %d jobs', token, len(out))
        return out
