# Europe jobs & internships via Arbeitnow's public job-board API.
# See scrapers/europe_common.py for source verification notes.
#
#

from typing import Dict, List
from scrapers.base import BaseScraper
from scrapers.europe_common import make_session, fetch_arbeitnow_entries, parse_arbeitnow_entry

class EuropeArbeitnowScraper(BaseScraper):
    source_name = 'europe_arbeitnow'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        seen_urls = set()
        session = make_session()
        try:
            entries = fetch_arbeitnow_entries(session=session, log=self.log)
            for entry in entries:
                try:
                    job = parse_arbeitnow_entry(entry)
                except Exception as exc:
                    self.log.debug('Europe/Arbeitnow parse failed: %s', exc)
                    continue
                url = job.get('apply_url') if job else None
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)
        finally:
            session.close()
        self.log.info('Europe/Arbeitnow collected %d jobs', len(jobs))
        return jobs
