"""
Ashby job boards — public, unauthenticated JSON API:
    GET https://api.ashbyhq.com/posting-api/job-board/{boardName}

`boardName` is the company's Ashby job-board slug (e.g. "ashby" for
jobs.ashbyhq.com/ashby). Configure in config.py under
ATS_COMPANIES["ashby"].
"""

import time
from typing import Dict, List

from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = "https://api.ashbyhq.com/posting-api/job-board/{board}"


class AshbyScraper(BaseScraper):

    source_name = "ashby"
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        boards = ATS_COMPANIES.get("ashby", [])
        session = make_session()
        jobs: List[Dict] = []

        try:
            for board in boards:
                try:
                    jobs.extend(self._fetch_board(session, board))
                except Exception as exc:
                    self.log.error("Ashby board '%s' failed: %s", board, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()

        jobs = dedupe(jobs)
        self.log.info("Ashby collected %d jobs across %d boards", len(jobs), len(boards))
        return jobs

    def _fetch_board(self, session, board: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(board=board), params={"includeCompensation": "true"})

        if not data:
            return []

        entries = data.get("jobs")
        if not isinstance(entries, list):
            return []

        company_name = board.replace("-", " ").replace("_", " ").title()

        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            location = entry.get("location", "") or entry.get("locationName", "")

            job = build_job(
                title=entry.get("title", ""),
                company=company_name,
                location=location,
                description=entry.get("descriptionPlain", "") or entry.get("description", ""),
                apply_url=entry.get("jobUrl", "") or entry.get("applyUrl", ""),
                is_remote=bool(entry.get("isRemote", False)) or None,
                posted_date=str(entry.get("publishedAt", "") or ""),
                source=self.source_name,
            )
            if job:
                out.append(job)

        self.log.info("Ashby[%s] -> %d jobs", board, len(out))
        return out
