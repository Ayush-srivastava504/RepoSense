from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import os
import random
import time

from playwright.sync_api import sync_playwright

from utils import (
    get_logger,
    make_session,
    make_job_id,
    utcnow,
)


class BaseScraper(ABC):

    source_name: str = "base"

    def __init__(self):
        self.session = make_session()
        self.log = get_logger(self.__class__.__name__)

    def run(
        self,
        keywords: Optional[List[str]] = None,
        locations: Optional[List[str]] = None,
        max_pages: int = 10,
    ) -> List[Dict]:

        self.log.info(
            "Starting %s scraper",
            self.source_name,
        )

        try:
            jobs = self.scrape(
                keywords=keywords or [],
                locations=locations or [],
                max_pages=max_pages,
            )

        except Exception as exc:

            self.log.error(
                "Scraper %s crashed: %s",
                self.source_name,
                exc,
                exc_info=True,
            )

            jobs = []

        for job in jobs:

            job.setdefault(
                "source",
                self.source_name,
            )

            job.setdefault(
                "scraped_at",
                utcnow(),
            )

            if not job.get("id"):

                job["id"] = make_job_id(
                    job.get("title", ""),
                    job.get("company", ""),
                    self.source_name,
                    job.get("apply_url", ""),
                )

        self.log.info(
            "Collected %d jobs from %s",
            len(jobs),
            self.source_name,
        )

        return jobs

    @abstractmethod
    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:
        ...

    @staticmethod
    def _empty_job() -> Dict:

        return {
            "id": None,
            "title": None,
            "company": None,
            "location": None,
            "type": None,
            "duration": None,
            "stipend": None,
            "salary": None,
            "description": None,
            "requirements": [],
            "skills": [],
            "apply_url": None,
            "source": None,
            "posted_date": None,
            "deadline": None,
            "is_remote": False,
            "experience_required": None,
            "scraped_at": None,
        }

    def _render_page(self, url: str, wait_ms: int = 7000, scroll_passes: int = 3) -> str:
        """
        Render a page using sparticuz Chromium (compatible with Amazon Linux 2).
        Uses the Lambda layer path /opt/chromium for the executable.
        """
        # Use sparticuz Chromium from Lambda layer
        chromium_path = os.getenv("CHROMIUM_PATH", "/opt/chromium/chromium")
        
        # Fallback to system chromium if available (for local dev)
        if not os.path.exists(chromium_path):
            chromium_path = os.getenv("CHROME_BINARY", "/usr/bin/google-chrome")
            if not os.path.exists(chromium_path):
                chromium_path = None

        with sync_playwright() as p:
            launch_options = {"headless": True}
            
            if chromium_path and os.path.exists(chromium_path):
                launch_options["executable_path"] = chromium_path
                self.log.debug("Using Chromium at: %s", chromium_path)
            
            browser = p.chromium.launch(**launch_options)
            
            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()
            
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(wait_ms)

            # Scroll to trigger lazy loading
            try:
                for _ in range(scroll_passes):
                    page.mouse.wheel(0, 3500)
                    page.wait_for_timeout(random.randint(1000, 2500))
            except Exception:
                pass

            html = page.content()
            browser.close()
            return html