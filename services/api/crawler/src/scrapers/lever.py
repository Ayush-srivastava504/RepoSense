# Lever job boards — public, unauthenticated JSON API:
# GET https://api.lever.co/v0/postings/{token}?mode=json
# `token` is the company's Lever site slug (e.g. "netflix" for
# jobs.lever.co/netflix). Configure tokens in config.py under

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, clean, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session
API_URL = 'https://api.lever.co/v0/postings/{token}'

class LeverScraper(BaseScraper):
    source_name = 'lever'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        tokens = ATS_COMPANIES.get('lever', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for token in tokens:
                try:
                    jobs.extend(self._fetch_board(session, token))
                except Exception as exc:
                    self.log.error("Lever board '%s' failed: %s", token, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Lever collected %d jobs across %d boards', len(jobs), len(tokens))
        return jobs

    def _fetch_board(self, session, token: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(token=token), params={'mode': 'json'})
        if not isinstance(data, list):
            return []
        company_name = token.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in data:
            if not isinstance(entry, dict):
                continue
            categories = entry.get('categories') or {}
            location = categories.get('location', '') if isinstance(categories, dict) else ''
            commitment = categories.get('commitment', '') if isinstance(categories, dict) else ''
            description = clean(entry.get('descriptionPlain', '') or entry.get('description', ''))
            job = build_job(title=entry.get('text', ''), company=company_name, location=location, description=description, apply_url=entry.get('hostedUrl', '') or entry.get('applyUrl', ''), job_type=None if not commitment else commitment.lower(), posted_date=str(entry.get('createdAt', '') or ''), source=self.source_name)
            if job:
                out.append(job)
        self.log.info('Lever[%s] -> %d jobs', token, len(out))
        return out
