# Freshteam (Freshworks) career sites — public JSON endpoint:
# GET https://{company}.freshteam.com/api/career_site/jobs
# `company` is the org's Freshteam subdomain (e.g. "acme" for
# acme.freshteam.com). Configure companies in config.py under
# ATS_COMPANIES['freshteam'].
#
# NOTE: Freshteam's public API surface is less consistently documented
# than Greenhouse/Lever/Ashby (no official public API reference — this is
# reverse-engineered from the career site's own network calls, same
# caveat FresherFlow notes for several of its ATS adapters). Treat 404s
# here as "this company's board isn't public/doesn't exist" rather than a
# scraper bug — same handling as every other ats_common-based scraper.

import time
from typing import Dict, List
from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = 'https://{company}.freshteam.com/api/career_site/jobs'


class FreshteamScraper(BaseScraper):
    source_name = 'freshteam'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('freshteam', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company))
                except Exception as exc:
                    self.log.error("Freshteam company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Freshteam collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_company(self, session, company: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(company=company))
        if not data:
            return []
        entries = data.get('jobs') if isinstance(data, dict) else data if isinstance(data, list) else None
        if not isinstance(entries, list):
            return []
        company_name = company.replace('-', ' ').replace('_', ' ').title()
        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            location = entry.get('location') or entry.get('branch_name') or ''
            job_id = entry.get('id', '')
            apply_url = entry.get('url', '') or (f'https://{company}.freshteam.com/jobs/{job_id}' if job_id else '')
            job = build_job(
                title=entry.get('title', ''),
                company=company_name,
                location=location,
                description=entry.get('description', '') or entry.get('requirements', ''),
                apply_url=apply_url,
                job_type=(entry.get('employment_type') or '').lower() or None,
                posted_date=str(entry.get('created_at', '') or ''),
                source=self.source_name,
            )
            if job:
                out.append(job)
        self.log.info('Freshteam[%s] -> %d jobs', company, len(out))
        return out
