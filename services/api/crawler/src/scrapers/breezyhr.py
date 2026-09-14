# Breezy HR job boards — public, unauthenticated JSON feed:
# GET https://{company}.breezy.hr/json
# `company` is the org's Breezy subdomain (e.g. "acme" for
# acme.breezy.hr). Returns a bare JSON array of open positions. Configure
# companies in config.py under ATS_COMPANIES['breezyhr'].

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = 'https://{company}.breezy.hr/json'


class BreezyHRScraper(BaseScraper):
    source_name = 'breezyhr'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('breezyhr', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company))
                except Exception as exc:
                    self.log.error("Breezy HR company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Breezy HR collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_company(self, session, company: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(company=company))
        # Breezy's /json endpoint returns a bare array, not an object —
        # fetch_json still works (it just json-decodes the response body),
        # but the "not data" falsy-check below has to treat an empty list
        # as "no jobs" rather than "request failed", unlike the ATS_common
        # helpers built around dict payloads.
        if data is None:
            return []
        entries = data if isinstance(data, list) else data.get('positions') if isinstance(data, dict) else None
        if not isinstance(entries, list):
            return []
        company_name = company.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            location_obj = entry.get('location') or {}
            location = location_obj.get('name', '') if isinstance(location_obj, dict) else str(location_obj or '')
            job_type_obj = entry.get('type') or {}
            job_type = job_type_obj.get('name', '') if isinstance(job_type_obj, dict) else None
            apply_url = entry.get('url', '') or entry.get('application_url', '')
            job = build_job(
                title=entry.get('name', ''),
                company=entry.get('company_name') or company_name,
                location=location,
                description=entry.get('description', ''),
                apply_url=apply_url,
                job_type=(job_type or '').lower() or None,
                posted_date=str(entry.get('published_date', '') or ''),
                source=self.source_name,
            )
            if job:
                out.append(job)
        self.log.info('Breezy HR[%s] -> %d jobs', company, len(out))
        return out
