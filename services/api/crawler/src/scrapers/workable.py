"""
Workable job boards — public widget JSON API:
    GET https://apply.workable.com/api/v1/widget/accounts/{account}

Returns all open jobs for that account in one shot (no pagination).
`account` is the company's Workable subdomain (e.g. "acme" for
apply.workable.com/acme). Configure in config.py under
ATS_COMPANIES["workable"].
"""

import time
from typing import Dict, List

from config import ATS_COMPANIES
from scrapers.ats_common import build_job, dedupe, fetch_json
from scrapers.base import BaseScraper
from utils import make_session

API_URL = "https://apply.workable.com/api/v1/widget/accounts/{account}"


class WorkableScraper(BaseScraper):

    source_name = "workable"
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        accounts = ATS_COMPANIES.get("workable", [])
        session = make_session()
        jobs: List[Dict] = []

        try:
            for account in accounts:
                try:
                    jobs.extend(self._fetch_account(session, account))
                except Exception as exc:
                    self.log.error("Workable account '%s' failed: %s", account, exc, exc_info=True)
                time.sleep(0.5)
        finally:
            session.close()

        jobs = dedupe(jobs)
        self.log.info("Workable collected %d jobs across %d accounts", len(jobs), len(accounts))
        return jobs

    def _fetch_account(self, session, account: str) -> List[Dict]:
        data = fetch_json(session, API_URL.format(account=account))

        if not data:
            return []

        entries = data.get("jobs")
        if not isinstance(entries, list):
            return []

        company_name = data.get("name") or account.replace("-", " ").title()

        out = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue

            location = ""
            loc_obj = entry.get("location")
            if isinstance(loc_obj, dict):
                location = ", ".join(
                    p for p in (loc_obj.get("city"), loc_obj.get("country")) if p
                )

            shortcode = entry.get("shortcode", "")
            apply_url = f"https://apply.workable.com/{account}/j/{shortcode}/" if shortcode else ""

            job = build_job(
                title=entry.get("title", ""),
                company=company_name,
                location=location,
                apply_url=apply_url,
                job_type=(entry.get("employment_type") or "").lower() or None,
                posted_date=str(entry.get("published_on", "") or ""),
                source=self.source_name,
            )
            if job:
                out.append(job)

        self.log.info("Workable[%s] -> %d jobs", account, len(out))
        return out
