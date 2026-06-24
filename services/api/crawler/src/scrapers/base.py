from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import os
import random
import time
import asyncio

from pyppeteer import launch
from pyppeteer.chromium_downloader import (
    chromium_executable,
    check_chromium,
)

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

    def _find_chromium(self) -> Optional[str]:
        """Find Chromium executable in all possible locations."""
        
        # 1. Try pyppeteer's built-in detection
        try:
            if check_chromium():
                path = chromium_executable()
                if path and os.path.exists(path):
                    self.log.info("Chromium found by pyppeteer: %s", path)
                    return path
        except Exception as e:
            self.log.debug("Pyppeteer detection failed: %s", e)
        
        # 2. Try Lambda Layer path
        layer_paths = [
            "/opt/chromium/chromium",
            "/opt/chrome/chrome",
        ]
        for path in layer_paths:
            if os.path.exists(path):
                self.log.info("Chromium found in Lambda Layer: %s", path)
                return path
        
        # 3. Try /tmp/pyppeteer (download location)
        try:
            tmp_path = "/tmp/pyppeteer/local-chromium"
            if os.path.exists(tmp_path):
                # Find the actual chrome binary
                for root, dirs, files in os.walk(tmp_path):
                    if "chrome" in files and os.path.exists(os.path.join(root, "chrome")):
                        path = os.path.join(root, "chrome")
                        self.log.info("Chromium found in /tmp/pyppeteer: %s", path)
                        return path
        except Exception as e:
            self.log.debug("Search in /tmp/pyppeteer failed: %s", e)
        
        # 4. Try environment variable
        env_path = os.getenv("CHROMIUM_PATH")
        if env_path and os.path.exists(env_path):
            self.log.info("Chromium from CHROMIUM_PATH: %s", env_path)
            return env_path
        
        # 5. Try system paths
        system_paths = [
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/usr/bin/chrome",
        ]
        for path in system_paths:
            if os.path.exists(path):
                self.log.info("Chromium found at system path: %s", path)
                return path
        
        self.log.warning("No Chromium found in any location!")
        return None

    def _render_page(self, url: str, wait_ms: int = 7000, scroll_passes: int = 3) -> str:
        """
        Render a page using pyppeteer with Chromium.
        Uses comprehensive Chromium detection.
        """
        # Find Chromium
        chromium_path = self._find_chromium()

        # Create event loop if not exists
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(
            self._async_render_page(chromium_path, url, wait_ms, scroll_passes)
        )

    async def _async_render_page(
        self,
        chromium_path: Optional[str],
        url: str,
        wait_ms: int,
        scroll_passes: int
    ) -> str:
        """Async implementation of page rendering optimized for Lambda."""
        
        # Lambda can only write to /tmp
        os.makedirs("/tmp/pyppeteer-profile", exist_ok=True)

        launch_options = {
            "headless": True,
            "userDataDir": "/tmp/pyppeteer-profile",
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
                "--no-zygote",
                "--disable-extensions",
                "--disable-background-networking",
                "--window-size=1440,900",
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-web-security",
            ]
        }

        if chromium_path and os.path.exists(chromium_path):
            launch_options["executablePath"] = chromium_path
            self.log.info("Using Chromium executable: %s", chromium_path)
        else:
            self.log.warning("No Chromium executable found, letting pyppeteer find it")

        browser = None

        try:
            browser = await launch(**launch_options)

            page = await browser.newPage()

            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )

            await page.setViewport({
                "width": 1440,
                "height": 900
            })

            await page.goto(
                url,
                {
                    "waitUntil": "networkidle2",
                    "timeout": 60000
                }
            )

            await page.waitFor(wait_ms)

            for _ in range(scroll_passes):
                try:
                    await page.evaluate(
                        "window.scrollBy(0, document.body.scrollHeight)"
                    )
                    await page.waitFor(1500)
                except Exception:
                    pass

            html = await page.content()

            return html

        except Exception as e:
            self.log.error(
                f"Error rendering page {url}: {str(e)}"
            )
            raise

        finally:
            if browser:
                await browser.close()