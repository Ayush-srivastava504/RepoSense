"""
Europe jobs & internships from We Work Remotely's public RSS feed,
client-filtered for European locations. See scrapers/europe_common.py for
source verification notes.
"""

from typing import Dict, List

from scrapers.base import BaseScraper
from scrapers.europe_common import (
    make_session,
    fetch_weworkremotely_europe_entries,
    parse_weworkremotely_entry,
)


class EuropeWeWorkRemotelyScraper(BaseScraper):

    source_name = "europe_weworkremotely"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []
        seen_urls = set()

        session = make_session()

        try:
            entries = fetch_weworkremotely_europe_entries(
                session=session, log=self.log,
            )

            for entry in entries:
                try:
                    job = parse_weworkremotely_entry(entry)
                except Exception as exc:
                    self.log.debug(
                        "Europe/WeWorkRemotely parse failed: %s", exc,
                    )
                    continue

                url = job.get("apply_url") if job else None
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)

        finally:
            session.close()

        self.log.info("Europe/WeWorkRemotely collected %d jobs", len(jobs))
        return jobs
