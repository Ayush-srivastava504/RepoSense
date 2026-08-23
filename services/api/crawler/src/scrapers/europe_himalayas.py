# Europe jobs & internships from Himalayas' browse API, client-filtered for
# European locations (same browse+filter pattern used successfully in
# scrapers/japan_common.py). See scrapers/europe_common.py for source
# verification notes.

from typing import Dict, List
from scrapers.base import BaseScraper
from scrapers.europe_common import make_session, fetch_himalayas_europe_entries, parse_himalayas_entry

class EuropeHimalayasScraper(BaseScraper):
    source_name = 'europe_himalayas'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        seen_urls = set()
        session = make_session()
        try:
            entries = fetch_himalayas_europe_entries(session=session, max_pages=max_pages, log=self.log)
            for entry in entries:
                try:
                    job = parse_himalayas_entry(entry)
                except Exception as exc:
                    self.log.debug('Europe/Himalayas parse failed: %s', exc)
                    continue
                url = job.get('apply_url') if job else None
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)
        finally:
            session.close()
        self.log.info('Europe/Himalayas collected %d jobs', len(jobs))
        return jobs
