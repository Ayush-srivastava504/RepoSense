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
GROK_API_URL = 'https://api.x.ai/v1/chat/completions'
GROK_MODEL = os.getenv('XAI_MODEL', 'grok-4.6')
XAI_API_KEY = os.getenv('XAI_API_KEY', '')
THIN_DESCRIPTION_CHARS = int(os.getenv('THIN_DESCRIPTION_CHARS', '400'))
BATCH_LIMIT = int(os.getenv('CONTENT_ENRICHMENT_BATCH_LIMIT', '60'))
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

def _call_grok(title: str, company: str, location: str, description: str, job_type: str) -> Optional[Dict]:
    user_prompt = '\n'.join([f'Title: {title}', f'Company: {company}', f'Location: {location or 'not specified'}', f'Listing type: {job_type or 'not specified'}', "Original description (may be short or messy — it's raw scraped text):", (description or '(no description provided)').strip()[:4000]])
    payload = {'model': GROK_MODEL, 'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': user_prompt}], 'temperature': 0.4, 'response_format': {'type': 'json_object'}}
    headers = {'Authorization': f'Bearer {XAI_API_KEY}', 'Content-Type': 'application/json'}
    try:
        resp = requests.post(GROK_API_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT_S)
        resp.raise_for_status()
        body = resp.json()
    except (requests.RequestException, ValueError) as exc:
        log.warning('Grok request failed: %s', exc)
        return None
    try:
        content = body['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError):
        log.warning('Unexpected Grok response shape: %s', body)
        return None
    parsed = _extract_json(content)
    if not parsed:
        log.warning('Could not parse Grok JSON output')
        return None
    overview = str(parsed.get('overview', '')).strip()
    keywords = parsed.get('keywords', [])
    if not isinstance(keywords, list):
        keywords = []
    keywords = [str(k).strip().lower() for k in keywords if str(k).strip()]
    word_count = len(overview.split())
    if word_count < MIN_OVERVIEW_WORDS:
        log.info('Overview too short (%d words), discarding', word_count)
        return None
    if word_count > MAX_OVERVIEW_WORDS:
        overview = ' '.join(overview.split()[:MAX_OVERVIEW_WORDS]) + '…'
    return {'overview': overview, 'keywords': keywords[:10]}

def _write_enrichment(job_id: str, overview: str, keywords: List[str]) -> None:
    conn = get_pg_conn()
    cursor = conn.cursor()
    cursor.execute('\n        UPDATE jobs\n        SET enriched_overview = %s,\n            enriched_keywords = %s,\n            enriched_model = %s,\n            enriched_at = now()\n        WHERE id = %s\n        ', (overview, keywords, GROK_MODEL, job_id))
    conn.commit()
    cursor.close()

def run_content_enrichment_for_new_jobs(jobs: List[Dict]) -> Dict:
    if not XAI_API_KEY:
        log.info('XAI_API_KEY not set — automatic content enrichment skipped for this run (daily catch-up job will still no-op safely too).')
        return {'enabled': False, 'attempted': 0, 'enriched': 0}
    thin_jobs = [j for j in jobs if j.get('id') and len(str(j.get('description') or '')) < THIN_DESCRIPTION_CHARS][:BATCH_LIMIT]
    if not thin_jobs:
        return {'enabled': True, 'attempted': 0, 'enriched': 0}
    log.info('Automatic content enrichment: %d thin listing(s) from this run (capped at %d)', len(thin_jobs), BATCH_LIMIT)
    enriched_count = 0
    for job in thin_jobs:
        try:
            result = _call_grok(title=job.get('title', ''), company=job.get('company', ''), location=job.get('location', ''), description=job.get('description', ''), job_type=job.get('type', ''))
            if result:
                _write_enrichment(job['id'], result['overview'], result['keywords'])
                enriched_count += 1
        except Exception:
            log.exception('Content enrichment failed for job id=%s', job.get('id'))
        time.sleep(REQUEST_DELAY_S)
    log.info('Automatic content enrichment done: %d/%d enriched', enriched_count, len(thin_jobs))
    return {'enabled': True, 'attempted': len(thin_jobs), 'enriched': enriched_count}
