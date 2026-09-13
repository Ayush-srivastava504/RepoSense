# Module: crawler/src/structured_enrichment.py
# Ported from FresherFlow's packages/pipeline/src/core/enricher.ts +
# enricher-schema.ts. content_enrichment.py already produces a single
# prose overview + search keywords; this module is additive and produces
# the structured breakdown FresherFlow's job detail page shows
# (Education / Requirements / Key Skills / Notes), stored in the columns
# added by migrations/021_structured_job_details.sql.
#
# Same two-path design as content_enrichment.py: a Groq LLM call when a
# key is configured, and a deterministic rule-based fallback (ported from
# enrichJobRuleBased in enricher.ts) when it isn't — so a job with no LLM
# access still gets *something* better than nothing, rather than silently
# skipping structured fields entirely. The rule-based path also attempts
# structured_description: it never generates new prose, but if the raw
# posting already has headings (Responsibilities:, Eligibility, etc.) it
# re-emits that existing text under our four canonical section names.
#
# Defines function(s): extract_structured, run_structured_enrichment_for_jobs

import json
import os
import re
import time
from typing import Dict, List, Optional
import requests
from utils import get_logger, get_pg_conn

log = get_logger('structured_enrichment')

GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.3-70b-versatile')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
REQUEST_TIMEOUT_S = 30
REQUEST_DELAY_S = 1.0
BATCH_LIMIT = int(os.getenv('STRUCTURED_ENRICHMENT_BATCH_LIMIT', '250'))

ALLOWED_DEGREES = {'TENTH', 'INTER', 'DIPLOMA', 'DEGREE', 'PG'}
ALLOWED_WORK_MODES = {'ONSITE', 'REMOTE', 'HYBRID'}

# Mirrors enricher.ts's ENRICHER_SYSTEM_PROMPT 1:1, adapted for our field
# naming (snake_case to match the Postgres columns we write to).
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


def _extract_json(raw: str) -> Optional[dict]:
    raw = (raw or '').strip()
    fence_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None


# --- Rule-based fallback (ported from enrichJobRuleBased in enricher.ts) --

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


def _extract_passout_years(text: str) -> List[int]:
    years = sorted({int(y) for y in _PASSOUT_YEAR_RE.findall(text)})
    return years[:6]  # sanity cap — a listing mentioning 6+ distinct years is almost certainly noise


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


# --- structured_description fallback (no LLM) ------------------------
# Doesn't generate new prose (that really would risk inventing facts).
# Instead it detects headings the source posting already has (under any
# of the common synonyms scrapers see in the wild) and re-emits the
# *existing* text under our four canonical heading names, in a fixed
# order. If the raw text has no recognizable headings, we still return
# None rather than guess at structure that isn't there.

_SECTION_SYNONYMS = [
    ('About the Role', [
        r'about the role', r'about the job', r'about this role', r'job description',
        r'company overview', r'about\s+' + r'[A-Za-z0-9&.\-]+', r'overview',
    ]),
    ('Responsibilities', [
        r'key responsibilities', r'roles?\s*(?:and|&)\s*responsibilities',
        r'job responsibilities', r'responsibilities', r'duties', r'what you.ll do',
        r'day\s*to\s*day', r'job role',
    ]),
    ('Requirements', [
        r'required skills', r'skills required', r'key skills', r'required qualifications',
        r'requirements', r'qualifications?', r'what we.re looking for', r'desired skills',
        r'who we.re looking for', r'skills\s*(?:and|&)\s*qualifications',
    ]),
    ('Eligibility', [
        r'eligibility criteria', r'eligibility', r'who can apply', r'eligible candidates',
    ]),
]

# One compiled pattern per canonical heading: matches a line that is
# *only* the heading (optionally trailing ':' / '-'), so we don't match
# the phrase mid-sentence inside a paragraph.
_SECTION_PATTERNS = [
    (canonical, re.compile(
        r'^\s*(?:' + '|'.join(synonyms) + r')\s*[:\-]?\s*$', re.I
    ))
    for canonical, synonyms in _SECTION_SYNONYMS
]

_CANONICAL_ORDER = ['About the Role', 'Responsibilities', 'Requirements', 'Eligibility']


def rule_based_structured_description(description: str) -> Optional[str]:
    if not description or not description.strip():
        return None
    lines = description.replace('\r\n', '\n').replace('\r', '\n').split('\n')

    # Find every line that matches one of our canonical headings.
    hits = []  # list of (line_index, canonical_name)
    for idx, line in enumerate(lines):
        for canonical, pattern in _SECTION_PATTERNS:
            if pattern.match(line):
                hits.append((idx, canonical))
                break

    if not hits:
        return None  # nothing recognizable — don't fabricate structure

    # Slice the body text between each heading hit and the next one.
    sections: Dict[str, List[str]] = {}
    for i, (line_idx, canonical) in enumerate(hits):
        end_idx = hits[i + 1][0] if i + 1 < len(hits) else len(lines)
        body = '\n'.join(lines[line_idx + 1:end_idx]).strip('\n')
        body = re.sub(r'\n{3,}', '\n\n', body).strip()
        if body:
            sections.setdefault(canonical, []).append(body)

    if not sections:
        return None  # headings existed but every section was empty

    out_parts = []
    for canonical in _CANONICAL_ORDER:
        if canonical in sections:
            out_parts.append(canonical)
            out_parts.append('\n\n'.join(sections[canonical]))
    return '\n\n'.join(out_parts).strip() or None


def rule_based_extract(title: str, company: str, location: str, description: str, job_type: str) -> Dict:
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
        'structured_description': rule_based_structured_description(description),
        'model': 'rule-based-fallback',
    }


def _validate_and_clean(payload: Dict) -> Dict:
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


def extract_structured(title: str, company: str, location: str, description: str, job_type: str) -> Dict:
    fallback = rule_based_extract(title, company, location, description, job_type)
    if not GROQ_API_KEY:
        return _validate_and_clean(fallback)
    user_prompt = '\n'.join([
        f'Title: {title}', f'Company: {company}', f'Location: {location or "not specified"}',
        f'Listing type: {job_type or "not specified"}',
        "Original description (raw scraped text, may be short or messy):",
        (description or '(no description provided)').strip()[:4000],
    ])
    payload = {'model': GROQ_MODEL, 'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': user_prompt}], 'temperature': 0.2, 'response_format': {'type': 'json_object'}}
    headers = {'Authorization': f'Bearer {GROQ_API_KEY}', 'Content-Type': 'application/json'}
    try:
        resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT_S)
        resp.raise_for_status()
        body = resp.json()
        content = body['choices'][0]['message']['content']
    except (requests.RequestException, ValueError, KeyError, IndexError, TypeError) as exc:
        log.warning('Groq structured-extraction request failed: %s — using rule-based fallback', exc)
        return _validate_and_clean(fallback)
    parsed = _extract_json(content)
    if not parsed:
        log.warning('Could not parse Groq structured JSON output — using rule-based fallback')
        return _validate_and_clean(fallback)
    parsed['model'] = GROQ_MODEL
    return _validate_and_clean(parsed)


def _write_structured(job_id: str, fields: Dict) -> None:
    conn = get_pg_conn()
    cursor = conn.cursor()
    cursor.execute(
        "\n        UPDATE jobs\n        SET allowed_degrees = %s,\n            allowed_courses = %s,\n            allowed_specializations = %s,\n            allowed_passout_years = %s,\n            required_skills = %s,\n            notes_highlights = %s,\n            work_mode = %s,\n            experience_min = %s,\n            experience_max = %s,\n            job_function = %s,\n            structured_description = %s\n        WHERE id = %s\n        ",
        (fields['allowed_degrees'], fields['allowed_courses'], fields['allowed_specializations'],
         fields['allowed_passout_years'], fields['required_skills'], fields['notes_highlights'],
         fields['work_mode'], fields['experience_min'], fields['experience_max'],
         fields['job_function'], fields['structured_description'], job_id),
    )
    conn.commit()
    cursor.close()


def run_structured_enrichment_for_jobs(jobs: List[Dict]) -> Dict:
    """Same thinnest-first priority as content_enrichment.py, same
    ai/fallback honesty split. Intentionally a separate pass rather than
    folded into the overview/keywords Groq call — keeps that already
    battle-tested path untouched, at the cost of one extra Groq call per
    job when a key is configured."""
    candidates = [j for j in jobs if j.get('id')]
    candidates.sort(key=lambda j: (len(str(j.get('description') or '')), j.get('quality_score', 100)))
    batch = candidates[:BATCH_LIMIT]
    if not batch:
        return {'enabled': bool(GROQ_API_KEY), 'attempted': 0, 'ai_enriched': 0, 'rule_based_fallback': 0}
    ai_count, fallback_count = 0, 0
    for job in batch:
        try:
            fields = extract_structured(title=job.get('title', ''), company=job.get('company', ''), location=job.get('location', ''), description=job.get('description', ''), job_type=job.get('type', ''))
            _write_structured(job['id'], fields)
            if fields.get('model') == 'rule-based-fallback':
                fallback_count += 1
            else:
                ai_count += 1
        except Exception:
            log.exception('Structured enrichment failed for job id=%s', job.get('id'))
        time.sleep(REQUEST_DELAY_S)
    log.info('Structured enrichment done: %d AI, %d rule-based fallback (of %d attempted)', ai_count, fallback_count, len(batch))
    return {'enabled': True, 'attempted': len(batch), 'ai_enriched': ai_count, 'rule_based_fallback': fallback_count}
