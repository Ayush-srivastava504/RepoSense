# Module: src/services/translation_enrichment_service.py
#
# Translates already-enriched job content (title / enriched_overview /
# structured_description) into a fixed set of target locales, for
# migrations/024_job_translations.sql. Per IMPLEMENTATION_PLAN.md §7:
# only content that's already been through content enrichment is ever
# translated (never raw, unvetted scraped text), and the locale list is
# deliberately small to start rather than all 9 i18n/config.ts locales —
# translating and maintaining 9 languages across ~15k jobs is a much bigger
# ongoing cost than 2, and the plan explicitly recommends starting with the
# largest non-English job-market languages.
#
# Unlike structured_enrichment_service.py / content_enrichment_service.py,
# there is no rule-based fallback here — a regex/keyword extractor can
# produce "something better than nothing" for structured fields, but there
# is no honest non-LLM substitute for translation. Without GROQ_API_KEY,
# this service simply does nothing (see enrich_all_content.py's
# --target translations, which refuses to run without a key rather than
# silently translating nothing and reporting success).

import asyncio
import json
import random
from dataclasses import dataclass
from typing import Optional

import httpx
from configs.config import settings

GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')
REQUEST_TIMEOUT_S = 30
MAX_RETRIES = 6
BACKOFF_BASE_S = 4.0
BACKOFF_MAX_S = 90.0

# Session 6 scope decision: es + pt only (largest non-English job-market
# languages, per IMPLEMENTATION_PLAN.md §7's own recommendation). Adding a
# locale later is additive — append its code+name here and to
# apps/web/lib/hreflang.ts's TRANSLATABLE_LOCALES; nothing else needs to
# change, since the worker query and the API/hreflang logic are both
# locale-list-driven, not hardcoded to two.
TRANSLATION_LOCALES = ['es', 'pt']
LOCALE_NAMES = {
    'es': 'Spanish', 'pt': 'Portuguese',
    # Configured in i18n/config.ts but not yet in TRANSLATION_LOCALES —
    # names kept here so extending the list above is a one-line change.
    'ja': 'Japanese', 'fr': 'French', 'de': 'German',
    'ko': 'Korean', 'it': 'Italian', 'hi': 'Hindi',
}

SYSTEM_PROMPT_TEMPLATE = '''You are a professional job-listing translator. Translate the given job \
posting fields from English into {language}.

Rules:
- Translate naturally, the way a native-{language}-speaking job board would phrase it — not word-for-word.
- NEVER translate or alter: company names, product/technology names, proper nouns, degree \
abbreviations (e.g. "B.Tech", "MCA"), or numbers/dates.
- Preserve the original meaning exactly. Never add, remove, or invent information that \
isn't in the source text.
- If "structured_description" is provided, keep its section-heading structure (one heading \
per line, e.g. "Responsibilities") — translate the heading words and the body text, not the \
formatting.
- If a field is null or empty in the input, return it as null in the output — do not invent content for it.

Respond with strict JSON only, no markdown fences, no commentary, matching exactly this shape:
{{"title": "...", "overview": "..." or null, "structured_description": "..." or null}}'''


@dataclass
class TranslationResult:
    title: str
    overview: Optional[str]
    structured_description: Optional[str]
    model: str


def _retry_delay(resp: 'httpx.Response', attempt: int) -> float:
    header = resp.headers.get('retry-after')
    delay = None
    if header:
        try:
            delay = float(header)
        except ValueError:
            delay = None
    if delay is None:
        delay = min(BACKOFF_BASE_S * (2 ** attempt), BACKOFF_MAX_S)
    return min(delay, BACKOFF_MAX_S) + random.uniform(0.5, 2.0)


def _extract_json(raw: str) -> Optional[dict]:
    import re
    raw = (raw or '').strip()
    fence_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None


class TranslationEnrichmentService:

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GROQ_API_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def translate(self, *, title: str, overview: Optional[str], structured_description: Optional[str],
                         locale: str) -> Optional[TranslationResult]:
        if not self.enabled:
            return None
        language = LOCALE_NAMES.get(locale)
        if not language:
            raise ValueError(f'Unknown locale {locale!r} — add it to LOCALE_NAMES first')
        user_payload = {
            'title': title,
            'overview': overview,
            'structured_description': (structured_description or None),
        }
        payload = {
            'model': GROQ_MODEL,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT_TEMPLATE.format(language=language)},
                {'role': 'user', 'content': json.dumps(user_payload)},
            ],
            'temperature': 0.2,
            'response_format': {'type': 'json_object'},
        }
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        content = None
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
                for attempt in range(MAX_RETRIES + 1):
                    resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
                    if resp.status_code == 429 or resp.status_code >= 500:
                        if attempt == MAX_RETRIES:
                            resp.raise_for_status()
                        delay = _retry_delay(resp, attempt)
                        print(f'[translation_enrichment] Groq {resp.status_code}, retry {attempt + 1}/{MAX_RETRIES} in {delay:.1f}s')
                        await asyncio.sleep(delay)
                        continue
                    resp.raise_for_status()
                    body = resp.json()
                    content = body['choices'][0]['message']['content']
                    break
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            print(f'[translation_enrichment] Groq request failed for locale {locale}: {exc}')
            return None
        parsed = _extract_json(content)
        if not parsed or not parsed.get('title'):
            print(f'[translation_enrichment] Could not parse Groq JSON output for locale {locale}')
            return None
        return TranslationResult(
            title=str(parsed['title']).strip()[:300],
            overview=(str(parsed['overview']).strip()[:4000] if parsed.get('overview') else None),
            structured_description=(str(parsed['structured_description']).strip()[:8000] if parsed.get('structured_description') else None),
            model=GROQ_MODEL,
        )
