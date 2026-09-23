# Automatic content enrichment — runs at the end of every crawl (see
# run_pipeline in index.py, right after upsert_jobs). Generates short,
# unique AI overview copy for the newly-written listings that are too thin
# to be worth indexing on their own (title + a couple of scraped lines),

import json
import os
import re
import time
from typing import Dict, List, Optional
import requests
from utils import get_logger, get_pg_conn
log = get_logger('content_enrichment')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
GROQ_MODEL = os.getenv('GROQ_MODEL', 'openai/gpt-oss-120b')
GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')
# Second and third providers, tried in order if Groq errors or is unset —
# see services/api/src/services/llm_providers.py for the API-compatible
# sibling used by the async enrichment path; this crawler hook is
# synchronous (runs inline at the end of a crawl via `requests`), so it
# duplicates the same three-endpoint shape rather than importing across
# the crawler/services boundary.
GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions'
NVIDIA_MODEL = os.getenv('NVIDIA_MODEL', 'moonshotai/kimi-k2.5')
NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY', '')
# (name, url, model, key) for every provider that has a key configured, in
# try-order. Empty when none are set, in which case callers fall back to
# the deterministic template.
PROVIDERS = [
    (name, url, model, key)
    for name, url, model, key in [
        ('groq', GROQ_API_URL, GROQ_MODEL, GROQ_API_KEY),
        ('gemini', GEMINI_API_URL, GEMINI_MODEL, GEMINI_API_KEY),
        ('nvidia', NVIDIA_API_URL, NVIDIA_MODEL, NVIDIA_API_KEY),
    ]
    if key
]
THIN_DESCRIPTION_CHARS = int(os.getenv('THIN_DESCRIPTION_CHARS', '400'))
# Was hardcoded at 60/run against a backlog in the thousands — mathematically
# could never catch up. Decoupled from a single constant: env-overridable,
# and the daily cron already passes --limit 100 separately, so raise the
# per-invocation default and let the two compose instead of each silently
# capping the other.
BATCH_LIMIT = int(os.getenv('CONTENT_ENRICHMENT_BATCH_LIMIT', '250'))
REQUEST_TIMEOUT_S = 30
REQUEST_DELAY_S = 1.0
MIN_OVERVIEW_WORDS = 60
MAX_OVERVIEW_WORDS = 220
SYSTEM_PROMPT = 'You write short, factual overview blurbs for job/internship listing pages on an Indian internship-and-jobs platform. You are given the raw scraped title, company, location, and description for one listing. Write 120-220 words of original, specific copy covering: what the company does (if inferable from its name/domain — say \'a company in <space>\' if not confidently known, never invent a specific product or history you\'re not given), what the role likely involves day to day based on the title/description, and what kind of candidate it suits. \n\nHard rules: never invent salary, stipend, deadline, headcount, or eligibility criteria that aren\'t present in the input — omit them rather than guess. Never claim the company has a specific culture, award, or perk you weren\'t told about. Write in plain, direct prose, not marketing fluff or listicle language. No headers, no bullet points, no emoji. Do not repeat the title or company name as a heading — start straight into the content. \n\nRespond with strict JSON only, no markdown fences: {"overview": "...", "keywords": ["...", "..."]}. keywords should be 5-10 lowercase phrases relevant to the role (skills, role type, seniority, domain) suitable for internal search — not generic filler like \'job\' or \'career\'.'

def _extract_json(raw: str) -> Optional[dict]:
    raw = raw.strip()
    fence_match = re.search('```(?:json)?\\s*(\\{.*?\\})\\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None

def _template_result(title: str, company: str, location: str, description: str, job_type: str) -> Dict:
    words = re.findall('[a-zA-Z][a-zA-Z0-9+.#]*', (title or '').lower())
    stop = {'the', 'a', 'an', 'and', 'or', 'for', 'of', 'to', 'in', 'at', 'on', 'with'}
    keywords = [w for w in words if w not in stop and len(w) > 2]
    for extra in (company, location, job_type):
        if extra:
            keywords.append(str(extra).strip().lower())
    seen, dedup = (set(), [])
    for k in keywords:
        if k not in seen:
            seen.add(k)
            dedup.append(k)
    company_part = f'at {company}' if company else 'with this employer'
    location_part = f' based in {location}' if location else ''
    snippet = (description or '').strip()
    snippet_part = f' The listing notes: {snippet[:200].strip()}' if snippet else ''
    overview = (
        f"This {job_type or 'role'} for {title} {company_part}{location_part} was sourced "
        f"directly from the employer's own listing. While we don't have enough scraped detail "
        f"yet to generate a full AI overview, the core details — title, company, and location "
        f"— are accurate and kept up to date.{snippet_part} Check the original posting via the "
        f"apply link on this page for the complete role description before applying."
    )
    return {'overview': overview, 'keywords': dedup[:10], 'model': 'template-fallback'}

def _call_provider(name: str, url: str, model: str, key: str, user_prompt: str) -> Optional[Dict]:
    payload = {'model': model, 'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': user_prompt}], 'temperature': 0.4, 'response_format': {'type': 'json_object'}}
    headers = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=REQUEST_TIMEOUT_S)
        resp.raise_for_status()
        body = resp.json()
    except (requests.RequestException, ValueError) as exc:
        log.warning('%s request failed: %s', name, exc)
        return None
    try:
        content = body['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError):
        log.warning('Unexpected %s response shape: %s', name, body)
        return None
    parsed = _extract_json(content)
    if not parsed:
        log.warning('Could not parse %s JSON output', name)
        return None
    overview = str(parsed.get('overview', '')).strip()
    keywords = parsed.get('keywords', [])
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(k).strip().lower() for k in keywords if str(k).strip()]
    word_count = len(overview.split())
    if word_count < MIN_OVERVIEW_WORDS:
        log.info('%s overview too short (%d words), discarding', name, word_count)
        return None
    if word_count > MAX_OVERVIEW_WORDS:
        overview = ' '.join(overview.split()[:MAX_OVERVIEW_WORDS]) + '…'
    return {'overview': overview, 'keywords': keywords[:10], 'model': model}

def _call_ai(title: str, company: str, location: str, description: str, job_type: str) -> Optional[Dict]:
    if not PROVIDERS:
        return {**_template_result(title, company, location, description, job_type)}
    user_prompt = '\n'.join([f'Title: {title}', f'Company: {company}', f'Location: {location or "not specified"}', f'Listing type: {job_type or "not specified"}', "Original description (may be short or messy — it's raw scraped text):", (description or '(no description provided)').strip()[:4000]])
    for name, url, model, key in PROVIDERS:
        result = _call_provider(name, url, model, key, user_prompt)
        if result:
            return result
    log.warning('All configured providers failed for this listing — using template fallback')
    return _template_result(title, company, location, description, job_type)

def _write_enrichment(job_id: str, overview: str, keywords: List[str], model: str) -> None:
    conn = get_pg_conn()
    cursor = conn.cursor()
    cursor.execute('\n        UPDATE jobs\n        SET enriched_overview = %s,\n            enriched_keywords = %s,\n            enriched_model = %s,\n            enriched_at = now()\n        WHERE id = %s\n        ', (overview, keywords, model, job_id))
    conn.commit()
    cursor.close()

def run_content_enrichment_for_new_jobs(jobs: List[Dict], bulk: bool=False) -> Dict:
    candidate_jobs = jobs if bulk else [j for j in jobs if j.get('id') and len(str(j.get('description') or '')) < THIN_DESCRIPTION_CHARS]
    candidate_jobs = [j for j in candidate_jobs if j.get('id')]
    # Was previously first-N-in-scrape-order, which has no relationship to
    # which jobs actually need enrichment most. Sort thinnest-description
    # first (and, when quality.py has already scored the job, lowest
    # quality_score first as a tiebreak) so a capped batch always spends
    # its budget on the jobs that need it most instead of whatever
    # happened to scrape first.
    candidate_jobs.sort(key=lambda j: (len(str(j.get('description') or '')), j.get('quality_score', 100)))
    thin_jobs = candidate_jobs[:BATCH_LIMIT]
    if not thin_jobs:
        return {'enabled': bool(PROVIDERS), 'attempted': 0, 'ai_enriched': 0, 'template_fallback': 0, 'enriched': 0}
    if not PROVIDERS:
        log.info('No content-enrichment provider configured (GROQ_API_KEY / GEMINI_API_KEY / NVIDIA_API_KEY all unset) — using template fallback content for this run (%d listing(s)).', len(thin_jobs))
    log.info('Automatic content enrichment: %d listing(s) from this run (capped at %d, bulk=%s, priority=thinnest-first, providers=%s)', len(thin_jobs), BATCH_LIMIT, bulk, [p[0] for p in PROVIDERS])
    ai_enriched_count = 0
    template_fallback_count = 0
    for job in thin_jobs:
        try:
            result = _call_ai(title=job.get('title', ''), company=job.get('company', ''), location=job.get('location', ''), description=job.get('description', ''), job_type=job.get('type', ''))
            if result:
                model = result.get('model', 'template-fallback')
                _write_enrichment(job['id'], result['overview'], result['keywords'], model)
                # Previously both paths were counted identically as
                # "enriched" — you could not tell from the summary whether
                # a run produced real AI overviews or copies of the same
                # boilerplate paragraph. Split them here.
                if model == 'template-fallback':
                    template_fallback_count += 1
                else:
                    ai_enriched_count += 1
        except Exception:
            log.exception('Content enrichment failed for job id=%s', job.get('id'))
        time.sleep(REQUEST_DELAY_S)
    total = ai_enriched_count + template_fallback_count
    log.info('Automatic content enrichment done: %d/%d enriched (%d real AI, %d template fallback)', total, len(thin_jobs), ai_enriched_count, template_fallback_count)
    if thin_jobs and template_fallback_count == total and total > 0:
        log.warning('This entire enrichment run (%d listings) fell back to template content — no provider key (GROQ/GEMINI/NVIDIA) is set, or all configured providers are failing on every call. Check the box .env.', total)
    return {'enabled': True, 'attempted': len(thin_jobs), 'ai_enriched': ai_enriched_count, 'template_fallback': template_fallback_count, 'enriched': total}
