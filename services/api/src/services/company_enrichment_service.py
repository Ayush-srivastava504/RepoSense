# Generates fallback content for company pages: a short company overview,
# a work-culture summary, a handful of review-style snippets, and search
# keywords — derived from the jobs already scraped for that company. Same
# Groq-backed pattern as content_enrichment_service.py, with a deterministic
# template fallback so bulk runs always produce something usable even
# without an API key or when a request fails.

import json
import re
from dataclasses import dataclass, field
from typing import Optional
import httpx
from configs.config import settings

GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = 'llama-3.3-70b-versatile'
REQUEST_TIMEOUT_S = 30
MIN_OVERVIEW_WORDS = 40
MAX_OVERVIEW_WORDS = 180

SYSTEM_PROMPT = (
    'You write short, factual "about this employer" content for company pages on an '
    'Indian internship-and-jobs platform. You are given a company name, a sample of job '
    'titles they have posted, and locations they hire in. Write: (1) a 60-120 word overview '
    'of what kind of company this likely is based on its name and hiring pattern, (2) a '
    '40-80 word "work culture" summary framed as general, plausible observations for a '
    'company of this type/size (never claim specific perks, ratings, or awards you were not '
    'given), and (3) 2-4 short, generic-but-plausible review-style snippets (5-20 words each) '
    'written as a neutral third party describing what candidates typically look for at a '
    'company like this — not as fabricated first-person employee quotes. '
    'Hard rules: never invent a specific founding year, funding amount, headcount, glassdoor '
    'rating, or named award. Never present the review snippets as real quotes from real '
    'employees. Write in plain, direct prose, no marketing fluff or emoji. '
    'Respond with strict JSON only, no markdown fences: '
    '{"overview": "...", "culture_summary": "...", "review_snippets": ["...", "..."], '
    '"keywords": ["...", "..."]}. keywords should be 5-10 lowercase phrases (industry, role '
    'types commonly hired, work style) suitable for internal search.'
)


@dataclass
class CompanyEnrichmentResult:
    overview: str
    culture_summary: str
    review_snippets: list[str] = field(default_factory=list)
    keywords: list[str] = field(default_factory=list)
    model: str = ''


def _build_user_prompt(company: str, sample_titles: list[str], locations: list[str]) -> str:
    lines = [
        f'Company: {company}',
        'Sample job titles they have posted: ' + (', '.join(sample_titles[:10]) or 'not available'),
        'Locations they hire in: ' + (', '.join(locations[:6]) or 'not specified'),
    ]
    return '\n'.join(lines)


def _extract_json(raw: str) -> Optional[dict]:
    raw = raw.strip()
    fence_match = re.search('```(?:json)?\\s*(\\{.*?\\})\\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None


def _template_keywords(company: str, sample_titles: list[str], locations: list[str]) -> list[str]:
    words = []
    for t in sample_titles:
        words.extend(re.findall('[a-zA-Z][a-zA-Z0-9+.#]*', t.lower()))
    stop = {'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'at', 'on', 'with'}
    keywords = [w for w in words if w not in stop and len(w) > 2]
    if company:
        keywords.append(company.strip().lower())
    for loc in locations:
        keywords.append(loc.strip().lower())
    seen = set()
    out = []
    for k in keywords:
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out[:10]


def _template_result(company: str, sample_titles: list[str], locations: list[str]) -> CompanyEnrichmentResult:
    roles = ', '.join(sample_titles[:3]) if sample_titles else 'a range of roles'
    loc_part = f" across {', '.join(locations[:3])}" if locations else ''
    overview = (
        f"{company} is an employer listed on this platform based on postings we've scraped "
        f"from their own job pages. Recent hiring activity includes roles such as {roles}{loc_part}. "
        f"We don't yet have enough independent detail to describe their business in more depth — "
        f"check the individual job listings and the company's own site for specifics before applying."
    )
    culture_summary = (
        f"Work culture varies by team and role at any company this size, and we don't have "
        f"verified, company-specific culture data for {company} yet. As a general rule for "
        f"employers hiring for roles like {roles}, candidates typically want to understand team "
        f"structure, on-site vs remote expectations, and growth path directly during the "
        f"interview process."
    )
    review_snippets = [
        "Candidates typically ask about team size and reporting structure before accepting.",
        "Clarify remote/hybrid expectations directly with the recruiter, as this varies by team.",
    ]
    return CompanyEnrichmentResult(
        overview=overview,
        culture_summary=culture_summary,
        review_snippets=review_snippets,
        keywords=_template_keywords(company, sample_titles, locations),
        model='template-fallback',
    )


class CompanyEnrichmentService:

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GROQ_API_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def enrich(self, *, company: str, sample_titles: list[str], locations: list[str], allow_fallback: bool = True) -> Optional[CompanyEnrichmentResult]:
        if not self.enabled:
            return _template_result(company, sample_titles, locations) if allow_fallback else None
        payload = {
            'model': GROQ_MODEL,
            'messages': [
                {'role': 'system', 'content': SYSTEM_PROMPT},
                {'role': 'user', 'content': _build_user_prompt(company, sample_titles, locations)},
            ],
            'temperature': 0.5,
            'response_format': {'type': 'json_object'},
        }
        headers = {'Authorization': f'Bearer {self.api_key}', 'Content-Type': 'application/json'}
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
                resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
                resp.raise_for_status()
                body = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            print(f'[company_enrichment] Groq request failed: {exc}')
            return _template_result(company, sample_titles, locations) if allow_fallback else None
        try:
            content = body['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            print(f'[company_enrichment] Unexpected Groq response shape: {body}')
            return _template_result(company, sample_titles, locations) if allow_fallback else None
        parsed = _extract_json(content)
        if not parsed:
            print('[company_enrichment] Could not parse Groq JSON output')
            return _template_result(company, sample_titles, locations) if allow_fallback else None
        overview = str(parsed.get('overview', '')).strip()
        culture_summary = str(parsed.get('culture_summary', '')).strip()
        review_snippets = parsed.get('review_snippets', [])
        if not isinstance(review_snippets, list):
            review_snippets = []
        review_snippets = [str(s).strip() for s in review_snippets if str(s).strip()][:6]
        keywords = parsed.get('keywords', [])
        if not isinstance(keywords, list):
            keywords = []
        keywords = [str(k).strip().lower() for k in keywords if str(k).strip()][:10]
        if len(overview.split()) < MIN_OVERVIEW_WORDS:
            print('[company_enrichment] Overview too short, using template fallback')
            return _template_result(company, sample_titles, locations) if allow_fallback else None
        if len(overview.split()) > MAX_OVERVIEW_WORDS:
            overview = ' '.join(overview.split()[:MAX_OVERVIEW_WORDS]) + '…'
        return CompanyEnrichmentResult(
            overview=overview,
            culture_summary=culture_summary,
            review_snippets=review_snippets,
            keywords=keywords,
            model=GROQ_MODEL,
        )
