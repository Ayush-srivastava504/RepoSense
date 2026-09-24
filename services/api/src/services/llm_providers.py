# Module: src/services/llm_providers.py
# Defines component(s)/export(s): ProviderConfig, call_chat_completion
#
# Groq, Google Gemini (via its OpenAI-compatibility endpoint — see
# https://ai.google.dev/gemini-api/docs/openai), and NVIDIA NIM
# (https://integrate.api.nvidia.com/v1) all accept the same OpenAI-style
# {model, messages, ...} POST to /chat/completions with a Bearer token, so
# one request shape and one response parse covers all three. That's what
# lets content_enrichment_service.py (and friends) try one provider, then
# fall through to the next on failure, without three separate client
# implementations.

from dataclasses import dataclass, field
from typing import Optional
import time
import httpx

# Model IDs that are known-good as of Sep 2026, appended after whatever the
# env/config asks for. Providers retire model IDs on fixed dates (Groq
# llama-3.3-70b on 2026-08-16, Gemini 2.5 on 2026-10-16 -- Google started
# 404ing it early); a stale GEMINI_MODEL / NVIDIA_MODEL in the server's .env
# must not take the whole provider down, so on a 404 we walk this list.
DEFAULT_MODELS = {
    'groq': ('openai/gpt-oss-120b', 'openai/gpt-oss-20b'),
    'gemini': ('gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'),
    'nvidia': ('nvidia/nemotron-3-super-120b-a12b', 'moonshotai/kimi-k2.5', 'z-ai/glm-5.1'),
}

DEFAULT_COOLDOWN_S = 60.0
MAX_COOLDOWN_S = 15 * 60.0


class ProviderHTTPError(httpx.HTTPError):
    """HTTP error carrying status, Retry-After and a body snippet, so callers
    can tell a rate limit (wait) from a retired model (try next model) from a
    bad key (give up on the provider)."""

    def __init__(self, provider: str, model: str, status: int, retry_after: Optional[float], body: str):
        super().__init__(f'{provider}/{model} HTTP {status}: {body[:300]}')
        self.provider = provider
        self.model = model
        self.status_code = status
        self.retry_after = retry_after
        self.body = body


def _parse_retry_after(resp: httpx.Response) -> Optional[float]:
    raw = resp.headers.get('retry-after')
    if raw:
        try:
            return max(0.0, float(raw))
        except ValueError:
            pass
    for h in ('x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens'):
        raw = resp.headers.get(h)
        if raw:
            # Groq sends e.g. "2m59.56s" / "7.66s"
            import re
            total, found = 0.0, False
            for num, unit in re.findall(r'([\d.]+)(ms|h|m|s)', raw):
                found = True
                total += float(num) * {'ms': 0.001, 's': 1, 'm': 60, 'h': 3600}[unit]
            if found:
                return total
    return None


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_url: str
    api_key: str
    model: str  # one model id, or a comma-separated priority list

    @property
    def models(self) -> tuple[str, ...]:
        configured = [m.strip() for m in self.model.split(',') if m.strip()]
        for m in DEFAULT_MODELS.get(self.name, ()):
            if m not in configured:
                configured.append(m)
        return tuple(configured)


@dataclass
class ProviderHealth:
    """Mutable per-run state for one provider (lives on the service)."""
    cooldown_until: float = 0.0
    dead: bool = False          # bad key / no usable model: skip for the rest of the run
    model_idx: int = 0          # index into ProviderConfig.models that last worked
    rate_limit_hits: int = 0
    retired_models: set = field(default_factory=set)

    def available(self) -> bool:
        return not self.dead and time.monotonic() >= self.cooldown_until

    def seconds_until_available(self) -> float:
        return 0.0 if self.dead else max(0.0, self.cooldown_until - time.monotonic())

    def rate_limited(self, retry_after: Optional[float]) -> float:
        self.rate_limit_hits += 1
        wait = retry_after if retry_after is not None else DEFAULT_COOLDOWN_S * min(self.rate_limit_hits, 4)
        wait = min(max(wait, 1.0), MAX_COOLDOWN_S)
        self.cooldown_until = time.monotonic() + wait
        return wait

    def succeeded(self) -> None:
        self.rate_limit_hits = 0


def groq_provider(api_key: str, model: str) -> ProviderConfig:
    return ProviderConfig('groq', 'https://api.groq.com/openai/v1/chat/completions', api_key, model)


def gemini_provider(api_key: str, model: str) -> ProviderConfig:
    return ProviderConfig('gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', api_key, model)


def nvidia_provider(api_key: str, model: str) -> ProviderConfig:
    return ProviderConfig('nvidia', 'https://integrate.api.nvidia.com/v1/chat/completions', api_key, model)


def enabled_providers(*candidates: Optional[ProviderConfig]) -> list[ProviderConfig]:
    """Drops any provider whose api_key is empty (i.e. not configured)."""
    return [p for p in candidates if p is not None and p.api_key]


async def call_chat_completion(
    provider: ProviderConfig,
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
    timeout_s: float = 30,
    json_object: bool = True,
    model: Optional[str] = None,
) -> str:
    """POSTs one chat-completion request and returns the raw message content
    string. Raises ProviderHTTPError (an httpx.HTTPError) / ValueError /
    KeyError on any failure -- callers are expected to catch and fall through
    to the next provider."""
    use_model = model or provider.models[0]
    payload = {
        'model': use_model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': temperature,
    }
    if json_object:
        payload['response_format'] = {'type': 'json_object'}
    headers = {'Authorization': f'Bearer {provider.api_key}', 'Content-Type': 'application/json'}
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        resp = await client.post(provider.api_url, headers=headers, json=payload)
        if resp.status_code >= 400:
            raise ProviderHTTPError(provider.name, use_model, resp.status_code, _parse_retry_after(resp), resp.text)
        body = resp.json()
    return body['choices'][0]['message']['content']
