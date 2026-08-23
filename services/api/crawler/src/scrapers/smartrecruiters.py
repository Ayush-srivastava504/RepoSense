# SmartRecruiters job boards — public, unauthenticated JSON API:
# GET https://api.smartrecruiters.com/v1/companies/{company}/postings
# Paginated via `offset`/`limit` (default page size 100). `company` is the
# company's SmartRecruiters identifier. Configure in config.py under

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session
API_URL = 'https://api.smartrecruiters.com/v1/companies/{company}/postings'
PAGE_SIZE = 100

class SmartRecruitersScraper(BaseScraper):
    source_name = 'smartrecruiters'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('smartrecruiters', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company, max_pages))
                except Exception as exc:
                    self.log.error("SmartRecruiters company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('SmartRecruiters collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_company(self, session, company: str, max_pages: int) -> List[Dict]:
        out = []
        offset = 0
        for _ in range(max_pages):
            data = fetch_json(session, API_URL.format(company=company), params={'limit': PAGE_SIZE, 'offset': offset})
            if not data:
                break
            entries = data.get('content')
            if not isinstance(entries, list) or not entries:
                break
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                location_obj = entry.get('location') or {}
                city = location_obj.get('city', '') if isinstance(location_obj, dict) else ''
                country = location_obj.get('country', '') if isinstance(location_obj, dict) else ''
                location = ', '.join((p for p in (city, country) if p))
                is_remote = bool(location_obj.get('remote', False)) if isinstance(location_obj, dict) else False
                ref = entry.get('id', '')
                apply_url = f'https://jobs.smartrecruiters.com/{company}/{ref}' if ref else ''
                job = build_job(title=entry.get('name', ''), company=entry.get('company', {}).get('name', company) if isinstance(entry.get('company'), dict) else company, location=location, apply_url=apply_url, is_remote=is_remote or None, posted_date=str(entry.get('releasedDate', '') or ''), source=self.source_name)
                if job:
                    out.append(job)
            if len(entries) < PAGE_SIZE:
                break
            offset += PAGE_SIZE
        self.log.info('SmartRecruiters[%s] -> %d jobs', company, len(out))
        return out
