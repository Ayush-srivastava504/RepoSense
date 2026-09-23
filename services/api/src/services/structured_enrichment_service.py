# Async counterpart to crawler/src/structured_enrichment.py, following the
# same split content_enrichment_service.py already made from
# crawler/src/content_enrichment.py: the crawler module runs inline at the
# end of every scrape (capped, per-run); this service is what
# scripts/enrich_all_content.py uses to backfill the *existing* DB backlog
# directly — jobs that scraped before structured_description/
# allowed_degrees/etc. existed, or that fell outside a run's BATCH_LIMIT.
#
# Kept as a faithful port rather than a shared import because the crawler
# package and this services package aren't on the same Python path at
# runtime (crawler runs as its own container/entrypoint) — content_enrichment
# already made the same call, this just matches it.

import asyncio
import json
import random
import re
from dataclasses import dataclass
from typing import List, Optional

import httpx
from configs.config import settings

GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
# getattr (not settings.GROQ_MODEL directly): some tests substitute a
# stripped-down fake settings object that only sets GROQ_API_KEY /
# DATABASE_URL, and this is evaluated at import time — a plain attribute
# access would crash that import. See content_enrichment_service.py's
# header comment for why this is env-overridable at all.
GROQ_MODEL = getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')
FALLBACK_MODEL = 'rule-based-fallback'
REQUEST_TIMEOUT_S = 30
# 429 / 5xx handling: Groq rate-limits by requests *and* tokens per minute, so
# a fixed inter-request delay isn't enough on its own. We honor the server's
# retry-after header and fall back to exponential backoff with jitter.
MAX_RETRIES = 6
BACKOFF_BASE_S = 4.0
BACKOFF_MAX_S = 90.0

ALLOWED_DEGREES = {'TENTH', 'INTER', 'DIPLOMA', 'DEGREE', 'PG'}
ALLOWED_WORK_MODES = {'ONSITE', 'REMOTE', 'HYBRID'}

SYSTEM_PROMPT = '''You are an expert ATS Job Parsing & Standardization Engine.
Take a raw job/internship posting and extract a structured JSON payload adhering to these strict rules:

1. "allowed_degrees": array containing ONLY these exact enum values: "TENTH", "INTER", "DIPLOMA", "DEGREE", "PG". Empty array if not mentioned.
2. "allowed_courses": actual degree/course names (e.g. ["B.Tech", "B.E", "MCA"]). Empty array if not mentioned.
3. "allowed_specializations": branch names (e.g. ["Computer Science", "Electronics"]). Empty array if not mentioned.
4. "allowed_passout_years": array of numbers, eligible graduation years (e.g. [2025, 2026]). Empty array if none mentioned.
5. "required_skills": array of technical skills, tools, frameworks, or trade skills mentioned (e.g. ["Python", "React"] or ["Machine Operation", "Fitter"]).
6. "experience_min" and "experience_max": integer years. For freshers/entry-level, experience_min must be 0.
7. "work_mode": exactly one of "ONSITE", "REMOTE", "HYBRID", or null if undeterminable.
8. "job_function": short free-text role family, e.g. "Manufacturing Operations", "Software Development". null if unclear.
9. "notes_highlights": short callouts ONLY (shift timing, bond/service agreement, joining deadline). Must not exceed 25% of the description length. null if nothing notable.
10. "structured_description": rewrite the description using plain section heading lines WITHOUT markdown asterisks or hashes — just the words on their own line — choosing from: "About the Role", "Responsibilities", "Requirements", "Eligibility" (only include sections you have real content for). Never invent facts not present in the input.

Respond with strict JSON only, no markdown fences, no commentary.'''

COURSE_MAP = [
    (re.compile(r'\bb\.?com\b', re.I), 'B.Com', False),
    (re.compile(r'\bm\.?com\b', re.I), 'M.Com', True),
    (re.compile(r'\bmba\b', re.I), 'MBA', True),
    (re.compile(r'\bbba\b', re.I), 'BBA', False),
    (re.compile(r'\bb\.?tech\b', re.I), 'B.Tech', False),
    (re.compile(r'\bb\.?e\b', re.I), 'B.E', False),
    (re.compile(r'\bm\.?tech\b', re.I), 'M.Tech', True),
    (re.compile(r'\bmca\b', re.I), 'MCA', True),
    (re.compile(r'\bbca\b', re.I), 'BCA', False),
    (re.compile(r'\bb\.?sc\b', re.I), 'B.Sc', False),
    (re.compile(r'\bm\.?sc\b', re.I), 'M.Sc', True),
    (re.compile(r'\bb\.?a\b', re.I), 'B.A', False),
    (re.compile(r'\biti\b', re.I), 'ITI', False),
]

SKILL_LIST = [
    'Python', 'Java', 'C++', 'C#', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue',
    'Node.js', 'Express', 'Spring Boot', 'Django', 'Flask', 'SQL', 'PostgreSQL', 'MySQL',
    'MongoDB', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'REST API', 'GraphQL',
    'Machine Learning', 'AI', 'NLP', 'Data Analytics', 'HTML', 'CSS', 'Linux',
    'Accounts Payable', 'Invoice Processing', 'Financial Analysis', 'Reconciliation',
    'MS Office', 'Excel', 'Microsoft Word', 'Machine Operation', 'Fitter', 'Maintenance',
    'Quality Control', 'Safety Standards', '5S', 'Teamwork', 'CNC',
]

_PASSOUT_YEAR_RE = re.compile(r'\b(20[2-3][0-9])\b')
_EXPERIENCE_RE = re.compile(r'(\d+)\s*(?:-|to)\s*(\d+)\s*years?|(\d+)\+?\s*years?', re.I)


@dataclass
class StructuredResult:
    allowed_degrees: List[str]
    allowed_courses: List[str]
    allowed_specializations: List[str]
    allowed_passout_years: List[int]
    required_skills: List[str]
    notes_highlights: Optional[str]
    work_mode: Optional[str]
    experience_min: int
    experience_max: int
    job_function: Optional[str]
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
    raw = (raw or '').strip()
    fence_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None


def _extract_passout_years(text: str) -> List[int]:
    years = sorted({int(y) for y in _PASSOUT_YEAR_RE.findall(text)})
    return years[:6]


def _extract_experience(text: str):
    m = _EXPERIENCE_RE.search(text)
    if not m:
        return 0, 0
    if m.group(1) and m.group(2):
        return int(m.group(1)), int(m.group(2))
    if m.group(3):
        v = int(m.group(3))
        return v, v
    return 0, 0


def _extract_work_mode(text: str) -> Optional[str]:
    t = text.lower()
    if 'remote' in t or 'work from home' in t or 'wfh' in t:
        return 'REMOTE'
    if 'hybrid' in t:
        return 'HYBRID'
    if 'onsite' in t or 'on-site' in t or 'in office' in t or 'in-office' in t:
        return 'ONSITE'
    return None


def _rule_based_extract(title: str, company: str, location: Optional[str], description: Optional[str], job_type: Optional[str]) -> dict:
    text = f'{title}\n{description or ""}'

    allowed_passout_years = _extract_passout_years(text)
    exp_min, exp_max = _extract_experience(text)
    work_mode = _extract_work_mode(text + f' {location or ""}')

    courses_found, degrees = [], []
    seen_courses = set()
    for pattern, course, is_pg in COURSE_MAP:
        if pattern.search(text) and course not in seen_courses:
            seen_courses.add(course)
            courses_found.append(course)
            if is_pg and 'PG' not in degrees:
                degrees.append('PG')
    if re.search(r'\bDiploma\b', text, re.I) and 'DIPLOMA' not in degrees:
        degrees.append('DIPLOMA')
    if re.search(r'\b(12th|Intermediate|Inter)\b', text, re.I) and 'INTER' not in degrees:
        degrees.append('INTER')
    if re.search(r'\b10th\b', text, re.I) and 'TENTH' not in degrees:
        degrees.append('TENTH')
    if not degrees:
        degrees = ['DEGREE']

    required_skills = [s for s in SKILL_LIST if re.search(r'(?<!\w)' + re.escape(s) + r'(?!\w)', text, re.I)]

    notes_highlights = None
    if re.search(r'\bfreshers?\s*(are\s*)?eligible\b', text, re.I):
        notes_highlights = 'Freshers are eligible.'
    elif exp_min == 0 and exp_max <= 1:
        notes_highlights = '0-1 year experience eligible.'

    job_function = None
    role_match = re.search(r'(?:Job Role|Job Function)\s*\n?\s*(.+)', text, re.I)
    if role_match:
        job_function = role_match.group(1).strip()[:80]

    return {
        'allowed_degrees': degrees,
        'allowed_courses': courses_found or [],
        'allowed_specializations': [],
        'allowed_passout_years': allowed_passout_years,
        'required_skills': required_skills,
        'notes_highlights': notes_highlights,
        'work_mode': work_mode,
        'experience_min': exp_min,
        'experience_max': exp_max,
        'job_function': job_function,
        # No LLM/no-heading-detected structured_description here — leaving
        # this None rather than guessing is the same "omit, don't invent"
        # rule structured_enrichment.py's SYSTEM_PROMPT enforces for the
        # Groq path.
        'structured_description': None,
        'model': FALLBACK_MODEL,
    }


def _validate_and_clean(payload: dict) -> dict:
    payload['allowed_degrees'] = [d for d in (payload.get('allowed_degrees') or []) if d in ALLOWED_DEGREES] or ['DEGREE']
    payload['allowed_courses'] = [str(c).strip() for c in (payload.get('allowed_courses') or []) if str(c).strip()][:10]
    payload['allowed_specializations'] = [str(s).strip() for s in (payload.get('allowed_specializations') or []) if str(s).strip()][:10]
    try:
        payload['allowed_passout_years'] = sorted({int(y) for y in (payload.get('allowed_passout_years') or [])})[:6]
    except (TypeError, ValueError):
        payload['allowed_passout_years'] = []
    payload['required_skills'] = [str(s).strip() for s in (payload.get('required_skills') or []) if str(s).strip()][:15]
    wm = payload.get('work_mode')
    payload['work_mode'] = wm if wm in ALLOWED_WORK_MODES else None
    try:
        payload['experience_min'] = max(0, int(payload.get('experience_min') or 0))
        payload['experience_max'] = max(payload['experience_min'], int(payload.get('experience_max') or payload['experience_min']))
    except (TypeError, ValueError):
        payload['experience_min'], payload['experience_max'] = 0, 0
    notes = payload.get('notes_highlights')
    payload['notes_highlights'] = str(notes).strip()[:400] if notes else None
    jf = payload.get('job_function')
    payload['job_function'] = str(jf).strip()[:120] if jf else None
    sd = payload.get('structured_description')
    payload['structured_description'] = str(sd).strip()[:8000] if sd else None
    return payload


class StructuredEnrichmentService:

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.GROQ_API_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _fallback(self, *, title: str, company: str, location: Optional[str], description: Optional[str], job_type: Optional[str]) -> StructuredResult:
        cleaned = _validate_and_clean(_rule_based_extract(title, company, location, description, job_type))
        return StructuredResult(**cleaned)

    async def enrich(self, *, title: str, company: str, location: Optional[str] = None, description: Optional[str] = None, job_type: Optional[str] = None, allow_fallback: bool = True) -> Optional[StructuredResult]:
        if not self.enabled:
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        user_prompt = '\n'.join([
            f'Title: {title}', f'Company: {company}', f'Location: {location or "not specified"}',
            f'Listing type: {job_type or "not specified"}',
            "Original description (raw scraped text, may be short or messy):",
            (description or '(no description provided)').strip()[:4000],
        ])
        payload = {
            'model': GROQ_MODEL,
            'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': user_prompt}],
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
                        print(f'[structured_enrichment] Groq {resp.status_code}, retry {attempt + 1}/{MAX_RETRIES} in {delay:.1f}s')
                        await asyncio.sleep(delay)
                        continue
                    resp.raise_for_status()
                    body = resp.json()
                    content = body['choices'][0]['message']['content']
                    break
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            print(f'[structured_enrichment] Groq request failed: {exc}')
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        parsed = _extract_json(content)
        if not parsed:
            print('[structured_enrichment] Could not parse Groq JSON output')
            return self._fallback(title=title, company=company, location=location, description=description, job_type=job_type) if allow_fallback else None
        parsed['model'] = GROQ_MODEL
        cleaned = _validate_and_clean(parsed)
        return StructuredResult(**cleaned)
