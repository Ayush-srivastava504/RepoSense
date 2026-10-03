# Workday career sites (PwC, NVIDIA, Adobe, Salesforce, Intel, Dell, Mastercard, Qualcomm, Walmart, ...).
#
# Many large employers have no Greenhouse/Lever board; they run Workday, whose public career pages are backed by
# an unauthenticated JSON API:
#   POST https://{host}/wday/cxs/{tenant}/{site}/jobs   {"limit":20,"offset":0,"searchText":"intern"}
#   GET  https://{host}/wday/cxs/{tenant}/{site}{externalPath}            (full description + start date)
# Tenants live in ats_candidates.WORKDAY_TENANTS. NOT live-verified from the build sandbox: a wrong tenant/site
# 404s and is skipped with a log line. Check with `python probe_boards.py` on EC2.

import re
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from ats_candidates import WORKDAY_TENANTS
from scrapers.ats_common import build_job, clean, dedupe
from scrapers.base import BaseScraper
from utils import make_session

PAGE_SIZE = 20
QUERIES = ['intern', 'graduate', 'fresher', 'entry level', 'trainee', 'graduate engineer trainee', 'associate engineer', 'qa', 'test engineer']
MAX_PAGES_PER_QUERY = 3
MAX_DETAIL_FETCHES_PER_SITE = 40  # one extra request per kept job; caps run time
HEADERS = {'Content-Type': 'application/json', 'Accept': 'application/json'}
MULTI_LOCATION_RE = re.compile(r'^\d+\s+locations?$', re.I)
POSTED_AGO_RE = re.compile(r'(\d+)\+?\s+day', re.I)


def parse_posted_on(text: str, now: Optional[datetime] = None) -> str:
    """'Posted Today' / 'Posted Yesterday' / 'Posted 5 Days Ago' / 'Posted 30+ Days Ago' -> ISO date ('' if unknown)."""
    now = now or datetime.now(timezone.utc)
    lowered = (text or '').lower()
    if 'today' in lowered:
        days = 0
    elif 'yesterday' in lowered:
        days = 1
    else:
        match = POSTED_AGO_RE.search(lowered)
        if not match:
            return ''
        days = int(match.group(1))
    return (now - timedelta(days=days)).strftime('%Y-%m-%d')


def location_may_be_india(locations_text: str) -> bool:
    text = clean(locations_text)
    # Workday collapses multi-location postings into "3 Locations"; the detail call decides those.
    return 'india' in text.lower() or bool(MULTI_LOCATION_RE.match(text))


def parse_workday_job(company: str, host: str, site: str, listing: Dict, info: Optional[Dict]) -> Optional[Dict]:
    info = info or {}
    path = clean(listing.get('externalPath'))
    if not path:
        return None
    location = clean(info.get('location') or listing.get('locationsText'))
    country = info.get('country')
    country_name = clean(country.get('descriptor')) if isinstance(country, dict) else ''
    if 'india' not in f'{location} {country_name}'.lower():
        return None
    url = clean(info.get('externalUrl')) or f'https://{host}/en-US/{site}{path}'
    posted = clean(info.get('startDate')) or parse_posted_on(listing.get('postedOn', ''))
    remote_type = clean(info.get('remoteType')).lower()
    return build_job(
        title=listing.get('title'), company=company, location=location,
        description=clean(re.sub(r'<[^>]+>', ' ', info.get('jobDescription') or '')),
        apply_url=url, posted_date=posted,
        is_remote=('remote' in remote_type or 'remote' in location.lower()) or None,
        source='workday')


class WorkdayScraper(BaseScraper):
    source_name = 'workday'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        session = make_session()
        jobs: List[Dict] = []
        try:
            for site in WORKDAY_TENANTS:
                try:
                    jobs.extend(self._scrape_site(session, site, max(1, min(max_pages, MAX_PAGES_PER_QUERY))))
                except Exception as exc:
                    self.log.error('Workday %s/%s failed: %s', site['company'], site['site'], exc, exc_info=True)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('Workday collected %d jobs across %d sites', len(jobs), len(WORKDAY_TENANTS))
        return jobs

    def _post(self, session, url: str, body: Dict) -> Optional[Dict]:
        try:
            response = session.post(url, json=body, headers=HEADERS, timeout=30)
        except Exception as exc:
            self.log.warning('Workday request failed %s: %s', url, exc)
            return None
        if response.status_code != 200:
            self.log.warning('Workday HTTP %d for %s (wrong tenant/site, or blocked)', response.status_code, url)
            return None
        try:
            return response.json()
        except ValueError:
            return None

    def _scrape_site(self, session, site: Dict[str, str], pages: int) -> List[Dict]:
        host, tenant, name = site['host'], site['tenant'], site['company']
        base = f'https://{host}/wday/cxs/{tenant}/{site["site"]}'
        seen: Dict[str, Dict] = {}
        for query in QUERIES:
            for page in range(pages):
                data = self._post(session, f'{base}/jobs', {'appliedFacets': {}, 'limit': PAGE_SIZE,
                                                            'offset': page * PAGE_SIZE, 'searchText': query})
                postings = (data or {}).get('jobPostings')
                if not isinstance(postings, list) or not postings:
                    break
                for posting in postings:
                    path = posting.get('externalPath')
                    if path and path not in seen and location_may_be_india(posting.get('locationsText', '')):
                        seen[path] = posting
                time.sleep(0.4)
        out: List[Dict] = []
        for index, (path, posting) in enumerate(seen.items()):
            info = None
            if index < MAX_DETAIL_FETCHES_PER_SITE:
                try:
                    detail = session.get(f'{base}{path}', headers={'Accept': 'application/json'}, timeout=30)
                    if detail.status_code == 200:
                        info = (detail.json() or {}).get('jobPostingInfo')
                except Exception as exc:
                    self.log.debug('Workday detail failed %s: %s', path, exc)
                time.sleep(0.3)
            job = parse_workday_job(name, host, site['site'], posting, info)
            if job:
                out.append(job)
        self.log.info('Workday[%s/%s] -> %d India jobs (%d candidates)', name, site['site'], len(out), len(seen))
        return out
