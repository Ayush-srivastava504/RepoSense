"""Optional headless-browser fallback for pages that ship an empty HTML shell (client-side rendered).
Off unless --render is passed AND playwright is installed:  pip install playwright && playwright install chromium
The PoliteFetcher still runs the robots.txt check and rate limit first; this only re-reads an allowed page."""
from typing import Optional

BLOCKED_RESOURCES = {'image', 'media', 'font', 'stylesheet'}


class PlaywrightRenderer:
    def __init__(self, timeout_ms: int = 20000):
        self._timeout = timeout_ms
        self._pw = None
        self._browser = None

    async def _ensure(self) -> None:
        if self._browser:
            return
        from playwright.async_api import async_playwright          # lazy: not a hard dependency
        self._pw = await async_playwright().start()
        self._browser = await self._pw.chromium.launch()

    async def render(self, url: str, user_agent: str) -> Optional[tuple]:
        """-> (html, final_url) or None on any failure."""
        try:
            await self._ensure()
            ctx = await self._browser.new_context(user_agent=user_agent)
            try:
                page = await ctx.new_page()
                await page.route('**/*', lambda route: route.abort() if route.request.resource_type in BLOCKED_RESOURCES
                                 else route.continue_())
                await page.goto(url, wait_until='networkidle', timeout=self._timeout)
                return await page.content(), page.url
            finally:
                await ctx.close()
        except Exception:                                           # noqa: BLE001 - any browser failure = no render
            return None

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._pw:
            await self._pw.stop()
