# Module: crawler/src/llm_client.py
# Synchronous, resilient chat-completion client shared by content_enrichment.py and
# structured_enrichment.py. Sync port of services/api/src/services/llm_providers.py (the crawler
# and the API are separate containers, so it cannot be imported).
#
# Before this, each crawler enrichment call made ONE request per job at ~1 request/second, with no
# handling of HTTP 429. A Groq rate limit therefore failed every job in the batch (250 of 250 in
# the 2026-10-02 run) and each one was written to the DB as a template / rule-based row.
#
# What it does instead:
#   - paces each provider to its own requests/minute (GROQ_RPM / GEMINI_RPM / NVIDIA_RPM),
#   - on 429 puts that provider on cooldown (Retry-After honoured) and moves to the next provider,
#   - waits for the soonest provider only when that wait is short (LLM_MAX_INLINE_WAIT_S) and fits
#     inside the stage deadline; otherwise gives up and sets `exhausted`, so the caller stops the
#     stage and leaves the remaining rows for the scheduled backfill (enrich_all_content.py),
#   - 404/410 = retired model -> next model in the list; 401/403 = bad key -> provider is dead,
#   - 5xx / timeout / network error -> short backoff, then the next provider.
#
# complete() returns None when no provider could answer. It never invents content: callers must
# leave the row untouched on None so it is retried.

import os
import random
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import requests

URLS = {
    'groq': 'https://api.groq.com/openai/v1/chat/completions',
    'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    'nvidia': 'https://integrate.api.nvidia.com/v1/chat/completions',
}
# Known-good model ids, appended after whatever the env asks for (same list as llm_providers.py).
DEFAULT_MODELS = {
    'groq': ('openai/gpt-oss-120b', 'openai/gpt-oss-20b'),
    'gemini': ('gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-flash-latest'),
    'nvidia': ('nvidia/nemotron-3-super-120b-a12b', 'meta/llama-3.1-70b-instruct'),
}
# Requests per minute each provider is paced to. Below the free-tier limits on purpose: enrichment
# prompts are token-heavy, so the token quota is usually hit before the request quota.
DEFAULT_RPM = {'groq': 12.0, 'gemini': 10.0, 'nvidia': 20.0}

DEFAULT_COOLDOWN_S = 30.0
MAX_COOLDOWN_S = 15 * 60.0
TRANSIENT_COOLDOWN_S = 5.0
MAX_PASSES = 4  # provider sweeps per call before giving up on that row


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


# Longest single wait for a rate-limited provider. A longer Retry-After (typically a daily token
# quota) is treated as "out for this run".
MAX_INLINE_WAIT_S = _env_float('LLM_MAX_INLINE_WAIT_S', 90.0)


def _sleep(seconds: float) -> None:  # indirection so tests don't really sleep
    time.sleep(seconds)


def _now() -> float:
    return time.monotonic()


def parse_retry_after(headers) -> Optional[float]:
    raw = headers.get('retry-after')
    if raw:
        try:
            return max(0.0, float(raw))
        except ValueError:
            pass
    for name in ('x-ratelimit-reset-requests', 'x-ratelimit-reset-tokens'):
        raw = headers.get(name)
        if raw:
            total, found = 0.0, False
            for num, unit in re.findall(r'([\d.]+)(ms|h|m|s)', raw):  # Groq: "2m59.56s"
                found = True
                total += float(num) * {'ms': 0.001, 's': 1, 'm': 60, 'h': 3600}[unit]
            if found:
                return total
    return None


@dataclass
class Provider:
    name: str
    url: str
    key: str
    models: Tuple[str, ...]


@dataclass
class _Health:
    cooldown_until: float = 0.0
    dead: bool = False
    model_idx: int = 0
    rate_limit_hits: int = 0
    failures: int = 0
    retired: set = field(default_factory=set)
    min_interval_s: float = 0.0
    next_slot: float = 0.0

    def available(self) -> bool:
        return not self.dead and _now() >= self.cooldown_until

    def wait_s(self) -> float:
        return max(0.0, self.cooldown_until - _now())

    def slot_wait(self) -> float:
        return max(0.0, self.next_slot - _now())

    def reserve_slot(self) -> None:
        self.next_slot = max(_now(), self.next_slot) + self.min_interval_s


def build_providers() -> List[Provider]:
    """One Provider per configured key. Order: Groq, Gemini, NVIDIA."""
    out: List[Provider] = []
    for name in ('groq', 'gemini', 'nvidia'):
        key = os.getenv(f'{name.upper()}_API_KEY', '')
        if not key:
            continue
        configured = [m.strip() for m in os.getenv(f'{name.upper()}_MODEL', '').split(',') if m.strip()]
        models = list(configured)
        for m in DEFAULT_MODELS[name]:
            if m not in models:
                models.append(m)
        out.append(Provider(name, URLS[name], key, tuple(models)))
    return out


class LLMClient:
    def __init__(self, providers: Optional[List[Provider]] = None, deadline: Optional[float] = None):
        self.providers = build_providers() if providers is None else providers
        self.deadline = deadline  # monotonic timestamp; no waiting or new calls past it
        self.exhausted = False    # True once no provider can answer within the wait/deadline limits
        self.last_model = ''      # model id that produced the most recent successful answer
        self._rot = 0
        self._health: Dict[str, _Health] = {}
        for p in self.providers:
            rpm = _env_float(f'{p.name.upper()}_RPM', DEFAULT_RPM[p.name])
            self._health[p.name] = _Health(min_interval_s=60.0 / rpm if rpm > 0 else 0.0)

    @property
    def enabled(self) -> bool:
        return bool(self.providers)

    def provider_names(self) -> List[str]:
        return [p.name for p in self.providers]

    # -- scheduling ------------------------------------------------------------------------
    def _past_deadline(self, extra: float = 0.0) -> bool:
        return self.deadline is not None and _now() + extra >= self.deadline

    def _ordered(self) -> List[Provider]:
        if not self.providers:
            return []
        start = self._rot % len(self.providers)
        self._rot += 1
        rotated = self.providers[start:] + self.providers[:start]
        live = [p for p in rotated if self._health[p.name].available()]
        return sorted(live, key=lambda p: self._health[p.name].slot_wait())  # stable: keeps rotation on ties

    def _soonest_wait(self) -> Optional[float]:
        """Seconds until some non-dead provider is available again; None if all are dead."""
        waits = [h.wait_s() for h in self._health.values() if not h.dead]
        return min(waits) if waits else None

    # -- one request -----------------------------------------------------------------------
    def _try_provider(self, p: Provider, system: str, user: str, temperature: float,
                      timeout_s: float, json_object: bool) -> Optional[str]:
        h = self._health[p.name]
        while h.model_idx < len(p.models):
            model = p.models[h.model_idx]
            if model in h.retired:
                h.model_idx += 1
                continue
            payload = {'model': model, 'temperature': temperature,
                       'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user}]}
            if json_object:
                payload['response_format'] = {'type': 'json_object'}
            headers = {'Authorization': f'Bearer {p.key}', 'Content-Type': 'application/json'}
            wait = h.slot_wait()
            if wait > 0:
                if self._past_deadline(wait):
                    return None
                _sleep(wait)
            h.reserve_slot()
            try:
                resp = requests.post(p.url, headers=headers, json=payload, timeout=timeout_s)
                if resp.status_code == 400 and json_object and re.search(
                        r'response_format|json_object|json mode', resp.text or '', re.I):
                    payload.pop('response_format')  # some hosted models reject it; not a retired model
                    resp = requests.post(p.url, headers=headers, json=payload, timeout=timeout_s)
            except requests.RequestException:
                self._transient(h)
                return None
            status = resp.status_code
            if status == 200:
                try:
                    content = resp.json()['choices'][0]['message']['content']
                except (ValueError, KeyError, IndexError, TypeError):
                    self._transient(h)
                    return None
                h.rate_limit_hits = 0
                h.failures = 0
                self.last_model = model
                return content
            if status == 429:
                h.rate_limit_hits += 1
                ra = parse_retry_after(resp.headers)
                wait = ra if ra is not None else DEFAULT_COOLDOWN_S * min(h.rate_limit_hits, 4)
                h.cooldown_until = _now() + min(max(wait, 1.0), MAX_COOLDOWN_S)
                return None
            if status in (404, 410):  # retired / unknown model -> next model, same provider
                h.retired.add(model)
                h.model_idx += 1
                continue
            if status in (401, 403):
                h.dead = True
                return None
            self._transient(h)  # 5xx and anything else unexpected
            return None
        h.dead = True  # every model retired
        return None

    @staticmethod
    def _transient(h: _Health) -> None:
        h.failures += 1
        backoff = min(TRANSIENT_COOLDOWN_S * (2 ** (h.failures - 1)), 120.0)
        h.cooldown_until = _now() + backoff + random.uniform(0, 1.0)

    # -- public ----------------------------------------------------------------------------
    def complete(self, system: str, user: str, *, temperature: float = 0.4,
                 timeout_s: float = 30.0, json_object: bool = True) -> Optional[str]:
        """Raw message content from the first provider that answers, or None. None with
        `self.exhausted` set means "stop calling for this run"."""
        if not self.providers:
            self.exhausted = True
            return None
        for _ in range(MAX_PASSES):
            if self._past_deadline():
                self.exhausted = True
                return None
            for p in self._ordered():
                content = self._try_provider(p, system, user, temperature, timeout_s, json_object)
                if content is not None:
                    return content
            wait = self._soonest_wait()
            if wait is None or wait > MAX_INLINE_WAIT_S or self._past_deadline(wait):
                self.exhausted = True  # all dead, or the soonest retry is too far away to wait for
                return None
            if wait > 0:
                _sleep(wait)
        return None  # this row failed after MAX_PASSES sweeps; the next row may still succeed
