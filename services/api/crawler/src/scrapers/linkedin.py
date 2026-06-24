import os
import random

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


def _render_page(self, url: str) -> str:
    """Render a page with Playwright, with explicit timeouts throughout.

    Playwright manages its own browser binaries independently of
    pyppeteer -- installing one does nothing for the other. The
    Dockerfile must run `playwright install chromium` at build time
    with PLAYWRIGHT_BROWSERS_PATH pointed at /opt (not /tmp), or this
    will fail with "executable doesn't exist" at runtime.
    """

    browsers_path = os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "/opt/playwright-browsers")
    if not os.path.isdir(browsers_path):
        self.log.warning(
            "PLAYWRIGHT_BROWSERS_PATH (%s) does not exist -- Playwright "
            "browsers were likely not baked into the image at build time.",
            browsers_path,
        )

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            timeout=30000,  # hard cap on browser launch itself
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
            ],
        )

        try:
            context = browser.new_context(
                viewport={"width": 1400, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
            )

            page = context.new_page()
            page.set_default_navigation_timeout(30000)
            page.set_default_timeout(15000)

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except PlaywrightTimeoutError as e:
                self.log.warning("Playwright navigation timed out for %s: %s", url, str(e))
                raise

            page.wait_for_timeout(7000)

            try:
                for _ in range(3):
                    page.mouse.wheel(0, 4000)
                    page.wait_for_timeout(random.randint(1500, 3000))
            except Exception:
                pass

            return page.content()

        finally:
            browser.close()