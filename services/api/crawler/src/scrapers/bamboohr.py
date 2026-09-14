# BambooHR careers pages — public, unauthenticated JSON endpoint:
# GET https://{company}.bamboohr.com/careers/list
# `company` is the org's BambooHR subdomain (e.g. "acme" for
# acme.bamboohr.com/careers). Returns {"result": [...]} with every open
# posting for that org. Configure companies in config.py under
# ATS_COMPANIES['bamboohr'].
#
# NOTE: unlike Greenhouse/Lever/Ashby, this endpoint does not return a
# full description — only title/department/location/id. The per-job
# apply page (https://{company}.bamboohr.com/careers/{id}) has the full
# text; fetching each one individually is a Phase 2 follow-up (would need
# per-job HTTP calls rather than one call per company) rather than
# something worth doing in the initial pass here.

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = 'https://{company}.bamboohr.com/careers/list'


class BambooHRScraper(BaseScraper):
    source_name = 'bamboohr'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('bamboohr', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company))
                except Exception as exc:
                    self.log.error("BambooHR company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('BambooHR collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_company(self, session, company: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(company=company))
        if not data:
            return []
        entries = data.get('result')
        if not isinstance(entries, list):
            return []
        company_name = company.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            location_obj = entry.get('location') or {}
            city = location_obj.get('city', '') if isinstance(location_obj, dict) else ''
            state = location_obj.get('state', '') if isinstance(location_obj, dict) else ''
            location = ', '.join(p for p in (city, state) if p)
            job_id = entry.get('id', '')
            apply_url = f'https://{company}.bamboohr.com/careers/{job_id}' if job_id else ''
            job = build_job(
                title=entry.get('jobOpeningName', '') or entry.get('title', ''),
                company=company_name,
                location=location,
                description=entry.get('department', ''),
                apply_url=apply_url,
                is_remote=bool(location_obj.get('remote')) if isinstance(location_obj, dict) else None,
                source=self.source_name,
            )
            if job:
                out.append(job)
        self.log.info('BambooHR[%s] -> %d jobs', company, len(out))
        return out
