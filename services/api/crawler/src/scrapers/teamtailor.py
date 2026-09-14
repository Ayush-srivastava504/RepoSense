# Teamtailor job boards — public, unauthenticated JSON:API feed:
# GET https://{company}.teamtailor.com/jobs.json
# `company` is the org's Teamtailor subdomain (e.g. "acme" for
# acme.teamtailor.com). Returns {"jobs": [...]} in JSON:API resource
# shape (attributes nested under "attributes"). Configure companies in
# config.py under ATS_COMPANIES['teamtailor'].

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = 'https://{company}.teamtailor.com/jobs.json'


class TeamtailorScraper(BaseScraper):
    source_name = 'teamtailor'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('teamtailor', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company))
                except Exception as exc:
                    self.log.error("Teamtailor company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Teamtailor collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_company(self, session, company: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(company=company))
        if not data:
            return []
        entries = data.get('jobs')
        if not isinstance(entries, list):
            return []
        company_name = company.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            # JSON:API shape: real attributes live under entry['attributes'],
            # but Teamtailor's public jobs.json is a simplified flat variant
            # in practice — support both so a future format drift doesn't
            # silently zero this scraper out.
            attrs = entry.get('attributes', entry) if isinstance(entry.get('attributes'), dict) else entry
            title = attrs.get('title', '')
            location = attrs.get('location-name') or attrs.get('location', '') or ''
            remote = attrs.get('remote-status') or attrs.get('remote')
            apply_url = attrs.get('careersite-job-url') or attrs.get('url', '')
            job = build_job(
                title=title,
                company=company_name,
                location=location,
                description=attrs.get('body', '') or attrs.get('description', ''),
                apply_url=apply_url,
                is_remote=bool(remote) if remote is not None else None,
                posted_date=str(attrs.get('created-at', '') or attrs.get('start-date', '') or ''),
                source=self.source_name,
            )
            if job:
                out.append(job)
        self.log.info('Teamtailor[%s] -> %d jobs', company, len(out))
        return out
