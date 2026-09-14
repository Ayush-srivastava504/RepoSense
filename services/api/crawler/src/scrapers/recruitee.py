# Recruitee job boards — public, unauthenticated JSON API:
# GET https://{company}.recruitee.com/api/offers/
# `company` is the org's Recruitee subdomain (e.g. "acme" for
# acme.recruitee.com). Returns every open offer for that org in one shot
# (no pagination) under the "offers" key. Configure companies in
# config.py under ATS_COMPANIES['recruitee'].

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = 'https://{company}.recruitee.com/api/offers/'


class RecruiteeScraper(BaseScraper):
    source_name = 'recruitee'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('recruitee', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company))
                except Exception as exc:
                    self.log.error("Recruitee company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Recruitee collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_company(self, session, company: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(company=company))
        if not data:
            return []
        entries = data.get('offers')
        if not isinstance(entries, list):
            return []
        company_name = company.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            city = entry.get('city') or ''
            country = entry.get('country') or ''
            location = ', '.join(p for p in (city, country) if p)
            careers_url = entry.get('careers_url') or ''
            slug = entry.get('slug') or ''
            apply_url = careers_url or (f'https://{company}.recruitee.com/o/{slug}' if slug else '')
            job = build_job(
                title=entry.get('title', ''),
                company=entry.get('company_name') or company_name,
                location=location,
                description=entry.get('description', '') or entry.get('requirements', ''),
                apply_url=apply_url,
                is_remote=bool(entry.get('remote', False)) or None,
                job_type=(entry.get('employment_type_code') or '').lower() or None,
                posted_date=str(entry.get('published_at', '') or entry.get('created_at', '') or ''),
                source=self.source_name,
            )
            if job:
                out.append(job)
        self.log.info('Recruitee[%s] -> %d jobs', company, len(out))
        return out
