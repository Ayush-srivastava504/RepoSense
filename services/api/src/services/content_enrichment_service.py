# Generates short, unique "overview" copy for job/internship listings that
# are otherwise too thin to be worth indexing on their own — see the
# "Discovered - currently not indexed" bucket in Search Console coverage
# reports. Most scraped postings are just a title, company, and a couple of
# lines.
#
# Tries up to three independent providers before giving up on real AI copy
# for a row: Groq, then Gemini, then NVIDIA NIM (see llm_providers.py — all
# three speak the same OpenAI-style chat-completions schema). This is not
# just about resilience: each provider has its own separate rate limit, so
# a run that used to be capped by Groq's throughput alone can now push
# roughly 3x the listings through in the same wall-clock budget, and mixing
# three different models' phrasing across a run also reduces how
# template-similar consecutive overviews read.
#
# NOTE ON THE AUG 2026 OUTAGE: this file previously hardcoded
# GROQ_MODEL = 'llama-3.3-70b-versatile', which Groq deprecated and shut
# down on 2026-08-16 (see https://console.groq.com/docs/deprecations) —
# every request 404'd from that date on, which is why scheduled runs with
# --no-fallback were enriching 0/100 every time. Model IDs now come from
# settings (env-overridable) specifically so the next deprecation is a
# config change, not a silent 100% failure discovered days later in a CI
# log.

import json
import re
from dataclasses import dataclass
from typing import Optional
import httpx
from configs.config import settings
from services.llm_providers import (
    ProviderConfig, call_chat_completion, enabled_providers,
    gemini_provider, groq_provider, nvidia_provider,
)

FALLBACK_MODEL = 'template-fallback'
REQUEST_TIMEOUT_S = 30
MAX_OVERVIEW_WORDS = 220
MIN_OVERVIEW_WORDS = 60
SYSTEM_PROMPT = 'You write short, factual overview blurbs for job/internship listing pages on an Indian internship-and-jobs platform. You are given the raw scraped title, company, location, and description for one listing. Write 120-220 words of original, specific copy covering: what the company does (if inferable from its name/domain — say \'a company in <space>\' if not confidently known, never invent a specific product or history you\'re not given), what the role likely involves day to day based on the title/description, and what kind of candidate it suits. \n\nHard rules: never invent salary, stipend, deadline, headcount, or eligibility criteria that aren\'t present in the input — omit them rather than guess. Never claim the company has a specific culture, award, or perk you weren\'t told about. Write in plain, direct prose, not marketing fluff or listicle language. No headers, no bullet points, no emoji. Do not repeat the title or company name as a heading — start straight into the content. \n\nRespond with strict JSON only, no markdown fences: {"overview": "...", "keywords": ["...", "..."]}. keywords should be 5-10 lowercase phrases relevant to the role (skills, role type, seniority, domain) suitable for internal search — not generic filler like \'job\' or \'career\'.'

@dataclass
class EnrichmentResult:
    overview: str
    keywords: list[str]
    model: str

def _build_user_prompt(title: str, company: str, location: Optional[str], description: Optional[str], job_type: Optional[str]) -> str:
    lines = [f'Title: {title}', f'Company: {company}', f'Location: {location or "not specified"}', f'Listing type: {job_type or "not specified"}', "Original description (may be short or messy — it's raw scraped text):", (description or '(no description provided)').strip()[:4000]]
    return '\n'.join(lines)

def _extract_json(raw: str) -> Optional[dict]:
    raw = raw.strip()
    fence_match = re.search('```(?:json)?\\s*(\\{.*?\\})\\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None

def _template_keywords(title: str, company: str, location: Optional[str], job_type: Optional[str]) -> list[str]:
    words = re.findall('[a-zA-Z][a-zA-Z0-9+.#]*', (title or '').lower())
    stop = {'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'at', 'on', 'with'}
    keywords = [w for w in words if w not in stop and len(w) > 2]
    if company:
        keywords.append(company.strip().lower())
    if location:
        keywords.append(location.strip().lower())
    if job_type:
        keywords.append(job_type.strip().lower())
    seen = set()
    out = []
    for k in keywords:
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out[:10]

def _template_overview(title: str, company: str, location: Optional[str], description: Optional[str], job_type: Optional[str]) -> str:
    company_part = f"at {company}" if company else "with this employer"
    location_part = f" based in {location}" if location else ""
    type_part = job_type or "role"
    snippet = (description or '').strip()
    snippet_part = f" The listing notes: {snippet[:200].strip()}" if snippet else ""
    return (
        f"This {type_part} for {title} {company_part}{location_part} was sourced directly "
        f"from the employer's own listing. While we don't have enough scraped detail yet to "
        f"generate a full AI overview, the core details — title, company, and location — are "
        f"accurate and kept up to date.{snippet_part} Check the original posting via the apply "
        f"link on this page for the complete role description, responsibilities, and "
        f"eligibility criteria before applying."
    )

class ContentEnrichmentService:

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        gemini_api_key: Optional[str] = None,
        nvidia_api_key: Optional[str] = None,
    ):
        groq_key = api_key if api_key is not None else getattr(settings, 'GROQ_API_KEY', '')
        gemini_key = gemini_api_key if gemini_api_key is not None else getattr(settings, 'GEMINI_API_KEY', '')
        nvidia_key = nvidia_api_key if nvidia_api_key is not None else getattr(settings, 'NVIDIA_API_KEY', '')
        # Order matters: Groq first (fastest / cheapest), then Gemini, then
        # NVIDIA NIM. enabled_providers() drops any of the three whose key
        # is unset, so this works with just GROQ_API_KEY configured (the
        # old single-provider behavior) all the way up to all three.
        self._providers: list[ProviderConfig] = enabled_providers(
            groq_provider(groq_key, getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')),
            gemini_provider(gemini_key, getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')),
            nvidia_provider(nvidia_key, getattr(settings, 'NVIDIA_MODEL', 'moonshotai/kimi-k2.5')),
        )
        # Round-robin starting point so consecutive enrich() calls don't
        # all hit the same primary provider first — this is what actually
        # spreads a run's request volume across all configured providers'
        # separate rate limits instead of only using the others as a
        # backup for Groq's failures.
        self._next_start = 0

    @property
    def enabled(self) -> bool:
        return bool(self._providers)

    @property
    def api_key(self) -> str:
        """Back-compat: some callers/tests check truthiness of api_key to
        mean 'is any provider configured'. Returns the primary (Groq) key
        if set, else the first configured provider's key, else ''."""
        return self._providers[0].api_key if self._providers else ''

    def _fallback(self, *, title: str, company: str, location: Optional[str], description: Optional[str], job_type: Optional[str]) -> EnrichmentResult:
        return EnrichmentResult(
            overview=_template_overview(title, company, location, description, job_type),
            keywords=_template_keywords(title, company, location, job_type),
            model=FALLBACK_MODEL,
        )

    def _ordered_providers(self) -> list[ProviderConfig]:
        if not self._providers:
            return []
        start = self._next_start % len(self._providers)
        self._next_start = (self._next_start + 1) % len(self._providers)
        return self._providers[start:] + self._providers[:start]

    async def enrich(self, *, title: str, company: str, location: Optional[str]=None, description: Optional[str]=None, job_type: Optional[str]=None, allow_fallback: bool=True) -> Optional[EnrichmentResult]:
        if not self.enabled:
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        user_prompt = _build_user_prompt(title, company, location, description, job_type)
        for provider in self._ordered_providers():
            result = await self._try_provider(provider, user_prompt=user_prompt)
            if result:
                return result
        # Every configured provider either errored or returned unusable output.
        return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None

    async def _try_provider(self, provider: ProviderConfig, *, user_prompt: str) -> Optional[EnrichmentResult]:
        try:
            content = await call_chat_completion(
                provider, system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt,
                temperature=0.4, timeout_s=REQUEST_TIMEOUT_S, json_object=True,
            )
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            print(f'[content_enrichment] {provider.name} request failed: {exc}')
            return None
        parsed = _extract_json(content)
        if not parsed:
            print(f'[content_enrichment] Could not parse {provider.name} JSON output')
            return None
        overview = str(parsed.get('overview', '')).strip()
        keywords = parsed.get('keywords', [])
        if not isinstance(keywords, list):
            keywords = []
        keywords = [str(k).strip().lower() for k in keywords if str(k).strip()]
        word_count = len(overview.split())
        if word_count < MIN_OVERVIEW_WORDS:
            print(f'[content_enrichment] {provider.name} overview too short ({word_count} words), discarding')
            return None
        if word_count > MAX_OVERVIEW_WORDS:
            overview = ' '.join(overview.split()[:MAX_OVERVIEW_WORDS]) + '…'
        return EnrichmentResult(overview=overview, keywords=keywords[:10], model=provider.model)
