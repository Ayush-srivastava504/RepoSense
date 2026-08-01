"""
Japan jobs -- dedicated crawler for full-time/contract/part-time jobs based
in Japan or explicitly open to remote applicants based in Japan.

Internships are intentionally excluded here -- see scrapers/japan_internships.py
for the internship-specific crawler covering the same sources.

Sources (both public, unauthenticated JSON, no browser required):
  1. Jobicy's documented geo=japan filter.
  2. Remote OK's public feed, filtered client-side for Japan-related
     tags/locations (e.g. "japan", "tokyo", "jp").

(Himalayas was previously a third source here, scanned/filtered
client-side for Japan relevance. Removed entirely — the Himalayas API
was consistently returning 0 jobs, see scrapers/japan_common.py.)

Jobs from this scraper are tagged country="Japan" so they show up under
the Japan filter regardless of which underlying source found them.
"""

from typing import Dict, List

from scrapers.base import BaseScraper
from scrapers.japan_common import (
    make_session,
    fetch_jobicy_japan_entries,
    parse_jobicy_entry,
    fetch_remoteok_japan_entries,
    parse_remoteok_entry,
)


class JapanJobsScraper(BaseScraper):

    source_name = "japan_jobs"
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
            # Primary source: Jobicy's documented geo=japan filter (see
            # japan_common.py for why this is trusted over Himalayas'
            # unverified country filter).
            jobicy_entries = fetch_jobicy_japan_entries(
                session=session,
                log=self.log,
            )

            for entry in jobicy_entries:

                try:
                    job = parse_jobicy_entry(entry)
                except Exception as exc:
                    self.log.debug("Japan/Jobicy parse failed: %s", exc)
                    continue

                if not job or job.get("type") == "internship":
                    continue

                url = job.get("apply_url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)

            remoteok_entries = fetch_remoteok_japan_entries(
                session=session,
                log=self.log,
            )

            for entry in remoteok_entries:

                try:
                    job = parse_remoteok_entry(entry)
                except Exception as exc:
                    self.log.debug("Japan/RemoteOK parse failed: %s", exc)
                    continue

                if not job or job.get("type") == "internship":
                    continue

                url = job.get("apply_url")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    jobs.append(job)

        finally:
            session.close()

        self.log.info(
            "Japan jobs collected %d jobs total",
            len(jobs),
        )

        return jobs
