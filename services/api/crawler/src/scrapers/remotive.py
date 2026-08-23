# Remotive — https://remotive.com
# Public unauthenticated JSON API.
# No browser required.
#

import re
from typing import Dict, List, Optional
import requests
from scrapers.base import BaseScraper
API_URL = 'https://remotive.com/api/remote-jobs'
REQUEST_TIMEOUT = 30

class RemotiveScraper(BaseScraper):
    source_name = 'remotive'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        seen_urls = set()
        session = requests.Session()
        session.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9'})
        search_terms = keywords[:3] if keywords else [None]
        try:
            for term in search_terms:
                self.log.info('Remotive fetching term=%r', term)
                data = self._fetch(session=session, term=term)
                if data is None:
                    continue
                entries = data.get('jobs')
                if not isinstance(entries, list):
                    self.log.warning('Remotive invalid jobs field type=%s term=%r', type(entries).__name__, term)
                    continue
                self.log.info('Remotive term=%r returned %d jobs', term, len(entries))
                for entry in entries:
                    if not isinstance(entry, dict):
                        continue
                    url = entry.get('url')
                    if not url or url in seen_urls:
                        continue
                    try:
                        job = self._parse_entry(entry)
                    except Exception as exc:
                        self.log.debug('Remotive parse failed: %s', exc)
                        continue
                    if not job:
                        continue
                    seen_urls.add(url)
                    jobs.append(job)
        finally:
            session.close()
        self.log.info('Remotive collected %d jobs', len(jobs))
        return jobs

    def _fetch(self, session: requests.Session, term: Optional[str]) -> Optional[Dict]:
        params = {'search': term} if term else {}
        try:
            response = session.get(API_URL, params=params, timeout=REQUEST_TIMEOUT, allow_redirects=True)
        except requests.RequestException as exc:
            self.log.warning('Remotive request failed term=%r: %s', term, exc)
            return None
        content_type = response.headers.get('content-type', '').lower()
        self.log.info('Remotive HTTP %d content-type=%s bytes=%d url=%s', response.status_code, content_type, len(response.content), response.url)
        if response.status_code != 200:
            self.log.warning('Remotive HTTP failure %d body=%r', response.status_code, response.text[:300])
            return None
        body = response.text.strip()
        if not body:
            self.log.warning('Remotive returned empty response term=%r', term)
            return None
        if 'application/json' not in content_type:
            self.log.warning('Remotive returned non-JSON content-type=%s body=%r', content_type, body[:300])
            return None
        try:
            data = response.json()
        except ValueError as exc:
            self.log.warning('Remotive JSON decode failed: %s body=%r', exc, body[:300])
            return None
        if not isinstance(data, dict):
            self.log.warning('Remotive unexpected JSON root: %s', type(data).__name__)
            return None
        return data

    def _parse_entry(self, entry: Dict) -> Optional[Dict]:
        title = _clean(entry.get('title'))
        company = _clean(entry.get('company_name'))
        if not title or not company:
            return None
        apply_url = _clean(entry.get('url'))
        if not apply_url:
            return None
        job_type_raw = _clean(entry.get('job_type')).lower()
        if 'intern' in job_type_raw:
            job_type = 'internship'
        elif 'contract' in job_type_raw or 'freelance' in job_type_raw:
            job_type = 'contract'
        elif 'part' in job_type_raw:
            job_type = 'part-time'
        else:
            job_type = 'full-time'
        location = _clean(entry.get('candidate_required_location')) or 'Worldwide'
        tags = entry.get('tags')
        if not isinstance(tags, list):
            tags = []
        tags = [_clean(t) for t in tags if _clean(t)]
        return {'title': title, 'company': company, 'location': location, 'type': job_type, 'salary': _clean(entry.get('salary')) or None, 'description': entry.get('description'), 'skills': tags, 'apply_url': apply_url, 'posted_date': entry.get('publication_date') or '', 'is_remote': True, 'country': location}

def _clean(value) -> str:
    return re.sub('\\s+', ' ', str(value or '')).strip()
