# Module: crawler/src/structured_enrichment.py
# Ported from FresherFlow's packages/pipeline/src/core/enricher.ts +
# enricher-schema.ts. content_enrichment.py already produces a single
# prose overview + search keywords; this module is additive and produces
# the structured breakdown FresherFlow's job detail page shows
# (Education / Requirements / Key Skills / Notes), stored in the columns
# added by migrations/021_structured_job_details.sql.
#
# LLM calls go through llm_client.py (pacing, 429 cooldowns, provider rotation). The deterministic
# rule-based extractor (ported from enrichJobRuleBased in enricher.ts) is kept but is only written
# when ENRICHMENT_ALLOW_FALLBACK=1; by default a job the LLM could not handle is left untouched. The rule-based path also attempts
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
from llm_client import LLMClient
from utils import get_logger, get_pg_conn

log = get_logger('structured_enrichment')

REQUEST_TIMEOUT_S = 30
BATCH_LIMIT = int(os.getenv('STRUCTURED_ENRICHMENT_BATCH_LIMIT', '250'))
# Wall-clock budget for this stage. Rows not reached are left for the backfill.
STAGE_MAX_SECONDS = float(os.getenv('ENRICHMENT_STAGE_MAX_SECONDS', '900'))
# Default OFF: when no provider can answer, the row is left untouched (retried by the backfill)
# instead of being written with rule-based guesses such as allowed_degrees=['DEGREE']. Set to 1 to
# restore the old write-a-fallback behaviour.
ALLOW_FALLBACK = os.getenv('ENRICHMENT_ALLOW_FALLBACK', '0').lower() in ('1', 'true', 'yes')

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


def extract_structured(client: LLMClient, title: str, company: str, location: str, description: str, job_type: str) -> Optional[Dict]:
    """AI-extracted fields, or None when no provider produced usable output (the caller decides
    whether to write a rule-based fallback; see ALLOW_FALLBACK)."""
    user_prompt = '\n'.join([
        f'Title: {title}', f'Company: {company}', f'Location: {location or "not specified"}',
        f'Listing type: {job_type or "not specified"}',
        "Original description (raw scraped text, may be short or messy):",
        (description or '(no description provided)').strip()[:4000],
    ])
    for _ in range(2):  # one re-ask on unparseable output; transport retries live in the client
        content = client.complete(SYSTEM_PROMPT, user_prompt, temperature=0.2, timeout_s=REQUEST_TIMEOUT_S)
        if content is None:
            return None
        parsed = _extract_json(content)
        if isinstance(parsed, dict):
            parsed['model'] = client.last_model or 'unknown'
            return _validate_and_clean(parsed)
        log.warning('Could not parse structured JSON output')
    return None


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


def run_structured_enrichment_for_jobs(jobs: List[Dict], bulk: bool = False, client: Optional[LLMClient] = None) -> Dict:
    """Thinnest-first, AI-only (see ALLOW_FALLBACK). Separate pass from the overview call so a
    failure here never affects it.

    bulk=False (default): only jobs missing structured_description.
    bulk=True: every job in the list is a candidate. The backlog-wide backfill runs independently
    via scripts/enrich_all_content.py --target structured --bulk.
    """
    candidates = [j for j in jobs if j.get('id')] if bulk else [
        j for j in jobs if j.get('id') and not j.get('structured_description')
    ]
    candidates.sort(key=lambda j: (len(str(j.get('description') or '')), j.get('quality_score', 100)))
    batch = candidates[:BATCH_LIMIT]
    client = client or LLMClient(deadline=time.monotonic() + STAGE_MAX_SECONDS)
    empty = {'enabled': client.enabled, 'attempted': 0, 'ai_enriched': 0, 'rule_based_fallback': 0, 'deferred': 0}
    if not batch:
        return empty
    if not client.enabled:
        log.warning('No structured-enrichment provider configured — %d listing(s) left for the backfill.', len(batch))
        return {**empty, 'deferred': len(batch)}
    log.info('Structured enrichment: %d listing(s) (capped at %d, providers=%s, budget=%.0fs, fallback_writes=%s)', len(batch), BATCH_LIMIT, client.provider_names(), STAGE_MAX_SECONDS, ALLOW_FALLBACK)
    ai_count = fallback_count = attempted = 0
    for job in batch:
        if client.exhausted:
            log.warning('Structured enrichment stopping early: providers rate-limited/unavailable beyond this stage\'s limits.')
            break
        attempted += 1
        try:
            args = dict(title=job.get('title', ''), company=job.get('company', ''), location=job.get('location', ''), description=job.get('description', ''), job_type=job.get('type', ''))
            fields = extract_structured(client, **args)
            if fields is not None:
                _write_structured(job['id'], fields)
                ai_count += 1
            elif ALLOW_FALLBACK:
                _write_structured(job['id'], _validate_and_clean(rule_based_extract(**args)))
                fallback_count += 1
        except Exception:
            log.exception('Structured enrichment failed for job id=%s', job.get('id'))
    deferred = len(batch) - ai_count - fallback_count
    log.info('Structured enrichment done: %d AI, %d rule-based fallback, %d deferred to the backfill (of %d)', ai_count, fallback_count, deferred, len(batch))
    return {'enabled': True, 'attempted': attempted, 'ai_enriched': ai_count, 'rule_based_fallback': fallback_count, 'deferred': deferred}
