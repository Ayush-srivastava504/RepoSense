# Personio job boards — public, unauthenticated XML feed:
# GET https://{company}.jobs.personio.de/xml
# `company` is the org's Personio subdomain. Unlike every other ATS
# scraper in this package, Personio's public feed is XML rather than
# JSON, so this doesn't use ats_common.fetch_json — it fetches the raw
# response text and parses it with the stdlib xml.etree.ElementTree
# (no extra dependency needed). Configure companies in config.py under
# ATS_COMPANIES['personio'].

import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional
import requests
from config import ATS_COMPANIES
from scrapers.ats_common import DEFAULT_HEADERS, build_job, clean, dedupe
from scrapers.base import BaseScraper
from utils import make_session

FEED_URL = 'https://{company}.jobs.personio.de/xml'


class PersonioScraper(BaseScraper):
    source_name = 'personio'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        companies = ATS_COMPANIES.get('personio', [])
        session = make_session()
        jobs: List[Dict] = []
        try:
            for company in companies:
                try:
                    jobs.extend(self._fetch_company(session, company))
                except Exception as exc:
                    self.log.error("Personio company '%s' failed: %s", company, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Personio collected %d jobs across %d companies', len(jobs), len(companies))
        return jobs

    def _fetch_xml(self, session: requests.Session, url: str) -> Optional[ET.Element]:
        try:
            response = session.get(url, headers=DEFAULT_HEADERS, timeout=30)
        except requests.RequestException as exc:
            self.log.warning('Personio feed request failed %s: %s', url, exc)
            return None
        if response.status_code != 200:
            self.log.info('Personio feed HTTP %d for %s', response.status_code, url)
            return None
        try:
            return ET.fromstring(response.content)
        except ET.ParseError as exc:
            self.log.warning('Personio feed XML parse failed for %s: %s', url, exc)
            return None

    def _fetch_company(self, session, company: str) -> List[Dict]:
        root = self._fetch_xml(session, FEED_URL.format(company=company))
        if root is None:
            return []
        company_name = company.replace('-', ' ').replace('_', ' ').title()
        out = []
        for position in root.findall('.//position'):
            def field(tag: str) -> str:
                el = position.find(tag)
                return clean(el.text) if el is not None and el.text else ''

            title = field('name')
            office = field('office')
            department = field('department')
            employment_type = field('employmentType')
            recruiting_category = field('recruitingCategory')
            job_id_el = position.find('id')
            job_id = clean(job_id_el.text) if job_id_el is not None and job_id_el.text else ''
            apply_url_el = position.find('jobPostingUrl') or position.find('applyUrl')
            apply_url = clean(apply_url_el.text) if apply_url_el is not None and apply_url_el.text else (
                f'https://{company}.jobs.personio.de/job/{job_id}' if job_id else ''
            )
            description_parts = [field('jobDescriptions/jobDescription/jobDescriptionValue')]
            job = build_job(
                title=title,
                company=company_name,
                location=office,
                description=' '.join(p for p in description_parts if p) or department,
                apply_url=apply_url,
                job_type=(employment_type or recruiting_category or '').lower() or None,
                source=self.source_name,
            )
            if job:
                out.append(job)
        self.log.info('Personio[%s] -> %d jobs', company, len(out))
        return out
