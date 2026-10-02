"""Provider fallback chain (Groq -> Gemini -> NVIDIA) using services/api/src/services/llm_providers.py.
That module is dependency-light (httpx only), so it is imported from the API source tree locally and
copied next to this package in the Docker image (see Dockerfile)."""
import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

_API_SERVICES = Path(__file__).resolve().parents[2] / 'api' / 'src' / 'services'
for _p in (_API_SERVICES, Path(__file__).resolve().parent / 'vendor'):
    if _p.exists() and str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from llm_providers import (DEFAULT_RPM, ProviderHTTPError, call_chat_completion,  # noqa: E402
                           enabled_providers, gemini_provider, groq_provider, interval_for_rpm, nvidia_provider)


def providers_from_env() -> list:
    e = os.environ.get
    return enabled_providers(
        groq_provider(e('GROQ_API_KEY', ''), e('GROQ_MODEL', 'openai/gpt-oss-120b')),
        gemini_provider(e('GEMINI_API_KEY', ''), e('GEMINI_MODEL', 'gemini-3.1-flash-lite')),
        nvidia_provider(e('NVIDIA_API_KEY', ''), e('NVIDIA_MODEL', 'nvidia/nemotron-3-super-120b-a12b')))


class Writer:
    """Calls providers in order; a provider that rate-limits or errors is skipped for the rest of the run."""

    def __init__(self, providers: list):
        self.providers = providers
        self._dead: set = set()
        self._last: dict = {}

    async def complete(self, system: str, user: str) -> Optional[tuple]:
        """-> (raw text, 'provider/model') or None when every provider failed."""
        for p in self.providers:
            if p.name in self._dead:
                continue
            for model in p.models:
                await self._pace(p.name)
                try:
                    raw = await call_chat_completion(p, system_prompt=system, user_prompt=user, temperature=0.2,
                                                     timeout_s=60, json_object=True, model=model)
                    return raw, f'{p.name}/{model}'
                except ProviderHTTPError as err:
                    if err.status_code in (400, 404, 410):
                        continue                   # retired / unsupported model -> next model
                    self._dead.add(p.name)         # 401/403/429/5xx -> next provider
                    break
                except Exception:
                    self._dead.add(p.name)
                    break
        return None

    async def _pace(self, name: str) -> None:
        gap = interval_for_rpm(DEFAULT_RPM.get(name, 10.0))
        loop = asyncio.get_event_loop()
        wait = gap - (loop.time() - self._last.get(name, -1e9))
        if wait > 0:
            await asyncio.sleep(wait)
        self._last[name] = loop.time()
