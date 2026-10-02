"""Polite fetcher: honours robots.txt, rate-limits per host, caps size, stays on the company's site."""
import asyncio
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

from .domains import same_site
from .extract import MIN_USEFUL_CHARS, extract_page

USER_AGENT = 'InternFlowBot/1.0 (+https://intern-flow.in/about)'
MAX_BYTES = 1_500_000
MAX_RENDERS_PER_SITE = 4


@dataclass
class FetchResult:
    url: str
    final_url: str = ''
    status: int = 0
    html: str = ''
    error: Optional[str] = None
    rendered: bool = False

    @property
    def ok(self) -> bool:
        return self.status == 200 and not self.error and bool(self.html)


class PoliteFetcher:
    def __init__(self, client: Optional[httpx.AsyncClient] = None, delay_s: float = 1.5, timeout_s: float = 15,
                 renderer=None):
        self._client = client or httpx.AsyncClient(headers={'User-Agent': USER_AGENT, 'Accept': 'text/html'},
                                                   timeout=timeout_s, follow_redirects=True)
        self._owns_client = client is None
        self._delay_s = delay_s
        self._robots: dict = {}
        self._last_hit: dict = {}
        self._renderer = renderer
        self._renders: dict = {}

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def _robots_for(self, origin: str) -> Optional[RobotFileParser]:
        """None means 'cannot read robots.txt reliably' -> treated as disallowed this run (5xx / network error)."""
        if origin in self._robots:
            return self._robots[origin]
        rp: Optional[RobotFileParser] = RobotFileParser()
        try:
            await self._wait(origin)
            resp = await self._client.get(f'{origin}/robots.txt')
            if resp.status_code >= 500:
                rp = None
            elif resp.status_code >= 400:
                rp.parse([])                      # no robots.txt -> everything allowed
            else:
                rp.parse(resp.text.splitlines())
        except httpx.HTTPError:
            rp = None
        self._robots[origin] = rp
        return rp

    async def _wait(self, origin: str) -> None:
        last = self._last_hit.get(origin)
        if last is not None:
            gap = self._delay_s - (time.monotonic() - last)
            if gap > 0:
                await asyncio.sleep(gap)
        self._last_hit[origin] = time.monotonic()

    async def allowed(self, url: str) -> bool:
        p = urlparse(url)
        rp = await self._robots_for(f'{p.scheme}://{p.netloc}')
        return bool(rp and rp.can_fetch(USER_AGENT, url))

    async def fetch(self, url: str, site: str) -> FetchResult:
        """`site` is the company's official domain; a redirect that leaves it is rejected."""
        res = FetchResult(url=url)
        if not await self.allowed(url):
            res.error = 'robots_disallowed'
            return res
        origin = '{0.scheme}://{0.netloc}'.format(urlparse(url))
        try:
            await self._wait(origin)
            async with self._client.stream('GET', url) as resp:
                res.status = resp.status_code
                res.final_url = str(resp.url)
                if not same_site(urlparse(res.final_url).netloc, site):
                    res.error = 'offsite_redirect'
                    return res
                if 'html' not in resp.headers.get('content-type', '').lower():
                    res.error = 'not_html'
                    return res
                chunks, size = [], 0
                async for chunk in resp.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_BYTES:
                        break
                    chunks.append(chunk)
                res.html = b''.join(chunks).decode(resp.encoding or 'utf-8', errors='replace')
        except httpx.HTTPError as e:
            res.error = f'http_error:{type(e).__name__}'
            return res
        await self._maybe_render(res, url, site)
        return res

    async def _maybe_render(self, res: FetchResult, url: str, site: str) -> None:
        """Empty client-side-rendered shell -> re-read it in a headless browser (robots already checked)."""
        if not (self._renderer and res.status == 200 and res.html):
            return
        if len(extract_page(res.html, res.final_url or url).text) >= MIN_USEFUL_CHARS:
            return
        if self._renders.get(site, 0) >= MAX_RENDERS_PER_SITE:
            return
        self._renders[site] = self._renders.get(site, 0) + 1
        origin = '{0.scheme}://{0.netloc}'.format(urlparse(url))
        await self._wait(origin)
        got = await self._renderer.render(res.final_url or url, USER_AGENT)
        if got and same_site(urlparse(got[1]).netloc, site):
            res.html, res.final_url, res.rendered = got[0][:MAX_BYTES * 2], got[1], True
