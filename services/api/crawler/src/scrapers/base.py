from abc import ABC, abstractmethod
from typing import Dict, List, Optional

from playwright.sync_api import sync_playwright, Browser, Page

from utils import (
    get_logger,
    make_session,
    make_job_id,
    utcnow,
)

CHROMIUM_ARGS = [
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-setuid-sandbox",
]

NAV_TIMEOUT_MS = 120_000


class BaseScraper(ABC):

    source_name: str = "base"
    uses_browser: bool = True  # set False on subclasses that only need requests/bs4

    def __init__(self):
        self.session = make_session()
        self.log = get_logger(self.__class__.__name__)
        self._browser: Optional[Browser] = None
        self._playwright_ctx = None

    def run(
        self,
        keywords: Optional[List[str]] = None,
        locations: Optional[List[str]] = None,
        max_pages: int = 10,
    ) -> List[Dict]:

        self.log.info("Starting %s scraper", self.source_name)

        jobs: List[Dict] = []

        try:
            if self.uses_browser:
                self._playwright_ctx = sync_playwright().start()
                self._browser = self._playwright_ctx.chromium.launch(
                    headless=True,
                    args=CHROMIUM_ARGS,
                )

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

        finally:
            if self._browser:
                try:
                    self._browser.close()
                except Exception:
                    pass
            if self._playwright_ctx:
                try:
                    self._playwright_ctx.stop()
                except Exception:
                    pass

        for job in jobs:
            job.setdefault("source", self.source_name)
            job.setdefault("scraped_at", utcnow())
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

    def new_page(self) -> Page:
        """Subclasses call this instead of launching their own browser."""
        if not self._browser:
            raise RuntimeError(
                f"{self.source_name}: browser not initialized — "
                "set uses_browser=True or call new_page() only inside scrape()"
            )
        context = self._browser.new_context(
            viewport={"width": 1400, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        page.set_default_navigation_timeout(NAV_TIMEOUT_MS)
        page.set_default_timeout(NAV_TIMEOUT_MS)
        return page

    def goto(self, page: Page, url: str):
        """Standard navigation: domcontentloaded, 120s timeout."""
        return page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)

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