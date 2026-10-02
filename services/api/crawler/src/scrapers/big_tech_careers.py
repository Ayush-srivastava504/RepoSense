# Big-tech career sites with public JSON search APIs: Amazon and Microsoft.
#
# Why this exists: company_portals.py only knows how to read server-rendered HTML cards, and
# neither amazon.jobs nor apply.careers.microsoft.com renders job cards that way (both are JS apps
# backed by a JSON search API). Microsoft and Amazon were therefore never scraped at all. Hitting
# the same JSON endpoints the sites' own front-ends call needs no browser and no login.
#
# NOT live-verified from the build sandbox (no general internet access there). The endpoint shapes
# below match what the sites served when written; if one changes, that source logs a WARNING with the
# HTTP status / body prefix and returns [] instead of crashing the pipeline. Verify on EC2 with:
#   python src/index.py --dry-run --scrapers big_tech_careers --max-pages 1
# and read the "BigTech" log lines.

import time
from typing import Dict, List, Optional
from scrapers.ats_common import build_job, clean, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

AMAZON_API = 'https://www.amazon.jobs/en/search.json'
AMAZON_BASE = 'https://www.amazon.jobs'
AMAZON_PAGE_SIZE = 100

MICROSOFT_PCSX_API = 'https://apply.careers.microsoft.com/api/pcsx/search'
MICROSOFT_BASE = 'https://apply.careers.microsoft.com'
MICROSOFT_PAGE_SIZE = 20

# Early-career queries only: this is a student platform, and a full dump of either company's ~10k open
# roles would drown the feed. "India" matches the platform's primary audience.
QUERIES = ['intern', 'internship', 'graduate', 'new grad', 'software engineer']
LOCATION = 'India'
MAX_PAGES_CAP = 3


def _amazon_date(raw: str) -> str:
    # Amazon sends e.g. 'September  1, 2026' (double space); emit ISO so the normalizer never has to guess.
    from datetime import datetime
    text = ' '.join((raw or '').split())
    for fmt in ('%B %d, %Y', '%b %d, %Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(text, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return ''


def parse_amazon_job(entry: Dict) -> Optional[Dict]:
    path = clean(entry.get('job_path'))
    if not path:
        return None
    description = ' '.join(
        part for part in (clean(entry.get('description_short') or entry.get('description')),
                          clean(entry.get('basic_qualifications')),
                          clean(entry.get('preferred_qualifications'))) if part)
    return build_job(
        title=entry.get('title'),
        company='Amazon',
        location=entry.get('normalized_location') or entry.get('location') or '',
        description=description,
        apply_url=path if path.startswith('http') else AMAZON_BASE + path,
        posted_date=_amazon_date(entry.get('posted_date')),
        source='big_tech_careers',
    )


def parse_microsoft_job(entry: Dict) -> Optional[Dict]:
    path = clean(entry.get('positionUrl') or entry.get('canonicalPositionUrl') or entry.get('url'))
    if not path:
        pid = clean(entry.get('id') or entry.get('displayJobId'))
        if not pid:
            return None
        path = f'/careers/job/{pid}'
    locations = entry.get('locations') or entry.get('standardizedLocations') or []
    if isinstance(locations, list):
        location = '; '.join(clean(loc) for loc in locations[:3] if clean(loc))
    else:
        location = clean(locations)
    posted = entry.get('postedTs') or entry.get('creationTs') or ''
    if isinstance(posted, (int, float)) and posted > 0:
        # Eightfold timestamps are epoch seconds (some tenants use ms).
        from datetime import datetime, timezone
        seconds = posted / 1000 if posted > 1e11 else posted
        posted = datetime.fromtimestamp(seconds, tz=timezone.utc).strftime('%Y-%m-%d')
    return build_job(
        title=entry.get('name') or entry.get('title'),
        company='Microsoft',
        location=location,
        description=clean(entry.get('description') or entry.get('department') or ''),
        apply_url=path if path.startswith('http') else MICROSOFT_BASE + path,
        posted_date=str(posted or ''),
        source='big_tech_careers',
    )


class BigTechCareersScraper(BaseScraper):
    source_name = 'big_tech_careers'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        session = make_session()
        jobs: List[Dict] = []
        pages = max(1, min(max_pages, MAX_PAGES_CAP))
        try:
            for fetch in (self._amazon, self._microsoft):
                try:
                    jobs.extend(fetch(session, pages))
                except Exception as exc:
                    self.log.error('BigTech %s failed: %s', fetch.__name__, exc, exc_info=True)
        finally:
            session.close()
        jobs = dedupe(jobs)
        self.log.info('BigTech collected %d jobs', len(jobs))
        return jobs

    def _amazon(self, session, pages: int) -> List[Dict]:
        out: List[Dict] = []
        for query in QUERIES:
            for page in range(pages):
                data = fetch_json(session, AMAZON_API, params={
                    'base_query': query, 'loc_query': LOCATION, 'country': 'IND',
                    'result_limit': AMAZON_PAGE_SIZE, 'offset': page * AMAZON_PAGE_SIZE, 'sort': 'recent'})
                entries = (data or {}).get('jobs') if isinstance(data, dict) else None
                if not isinstance(entries, list) or not entries:
                    if data is None:
                        self.log.warning('BigTech Amazon q=%r page=%d: no JSON (blocked or endpoint changed)', query, page)
                    break
                out.extend(j for j in map(parse_amazon_job, entries) if j)
                time.sleep(0.5)
        self.log.info('BigTech Amazon -> %d jobs', len(out))
        return out

    def _microsoft(self, session, pages: int) -> List[Dict]:
        out: List[Dict] = []
        for query in QUERIES:
            for page in range(pages):
                data = fetch_json(session, MICROSOFT_PCSX_API, params={
                    'domain': 'microsoft.com', 'query': query, 'location': LOCATION,
                    'start': page * MICROSOFT_PAGE_SIZE, 'sort_by': 'timestamp'})
                positions = None
                if isinstance(data, dict):
                    inner = data.get('data') if isinstance(data.get('data'), dict) else data
                    positions = inner.get('positions')
                if not isinstance(positions, list) or not positions:
                    if data is None:
                        self.log.warning('BigTech Microsoft q=%r page=%d: no JSON (blocked or endpoint changed)', query, page)
                    break
                out.extend(j for j in map(parse_microsoft_job, positions) if j)
                time.sleep(0.5)
        self.log.info('BigTech Microsoft -> %d jobs', len(out))
        return out
