# Europe jobs & internships from Remotive's public API, client-filtered for
# European locations. See scrapers/europe_common.py for source verification
# notes.
#

from typing import Dict, List
from scrapers.base import BaseScraper
from scrapers.europe_common import make_session, fetch_remotive_europe_entries, parse_remotive_entry

class EuropeRemotiveScraper(BaseScraper):
    source_name = 'europe_remotive'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        seen_urls = set()
        session = make_session()
        try:
            entries = fetch_remotive_europe_entries(session=session, log=self.log)
            for entry in entries:
                try:
                    job = parse_remotive_entry(entry)
                except Exception as exc:
                    self.log.debug('Europe/Remotive parse failed: %s', exc)
                    continue
                url = job.get('apply_url') if job else None
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)
        finally:
            session.close()
        self.log.info('Europe/Remotive collected %d jobs', len(jobs))
        return jobs
