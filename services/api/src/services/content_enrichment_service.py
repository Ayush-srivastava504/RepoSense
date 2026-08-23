# Generates short, unique "overview" copy for job/internship listings that
# are otherwise too thin to be worth indexing on their own — see the
# "Discovered - currently not indexed" bucket in Search Console coverage
# reports. Most scraped postings are just a title, company, and a couple of

import json
import re
from dataclasses import dataclass
from typing import Optional
import httpx
from configs.config import settings
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = 'llama-3.3-70b-versatile'
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

    def __init__(self, api_key: Optional[str]=None):
        self.api_key = api_key if api_key is not None else settings.GROQ_API_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _fallback(self, *, title: str, company: str, location: Optional[str], description: Optional[str], job_type: Optional[str]) -> EnrichmentResult:
        return EnrichmentResult(
            overview=_template_overview(title, company, location, description, job_type),
            keywords=_template_keywords(title, company, location, job_type),
            model='template-fallback',
        )

    async def enrich(self, *, title: str, company: str, location: Optional[str]=None, description: Optional[str]=None, job_type: Optional[str]=None, allow_fallback: bool=True) -> Optional[EnrichmentResult]:
        if not self.enabled:
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        payload = {'model': GROQ_MODEL, 'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': _build_user_prompt(title, company, location, description, job_type)}], 'temperature': 0.4, 'response_format': {'type': 'json_object'}}
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
                resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
                resp.raise_for_status()
                body = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            print(f'[content_enrichment] Groq request failed: {exc}')
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        try:
            content = body['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            print(f'[content_enrichment] Unexpected Groq response shape: {body}')
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        parsed = _extract_json(content)
        if not parsed:
            print('[content_enrichment] Could not parse Groq JSON output')
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        overview = str(parsed.get('overview', '')).strip()
        keywords = parsed.get('keywords', [])
        if not isinstance(keywords, list):
            keywords = []
        keywords = [str(k).strip().lower() for k in keywords if str(k).strip()]
        word_count = len(overview.split())
        if word_count < MIN_OVERVIEW_WORDS:
            print(f'[content_enrichment] Overview too short ({word_count} words), discarding')
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        if word_count > MAX_OVERVIEW_WORDS:
            overview = ' '.join(overview.split()[:MAX_OVERVIEW_WORDS]) + '…'
        return EnrichmentResult(overview=overview, keywords=keywords[:10], model=GROQ_MODEL)
