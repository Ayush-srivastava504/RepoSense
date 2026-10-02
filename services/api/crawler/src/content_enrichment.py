# Automatic content enrichment — runs at the end of every crawl (see run_pipeline in index.py,
# right after upsert_jobs). Generates short, unique AI overview copy for newly-written listings
# that are too thin to be worth indexing on their own (title + a couple of scraped lines).
#
# AI-only. When no provider can answer (rate limit, outage, bad output) the row is left untouched
# and counted as "deferred" -- it is NOT written with template text. A row with no enriched_overview
# stays out of the index (see phase_f's `NOT (is_thin AND enriched_overview IS NULL)`) and is picked
# up by the scheduled backfill: scripts/enrich_all_content.py --target jobs --redo-fallback
# --no-fallback (daily-pipeline.yml). Provider calls go through llm_client.py, which paces requests,
# honours Retry-After, rotates providers and stops the stage when quota is gone.

import json
import os
import re
import time
from typing import Dict, List, Optional
from llm_client import LLMClient
from utils import get_logger, get_pg_conn
log = get_logger('content_enrichment')
THIN_DESCRIPTION_CHARS = int(os.getenv('THIN_DESCRIPTION_CHARS', '400'))
# Per-run cap; the daily backfill handles whatever this leaves behind.
BATCH_LIMIT = int(os.getenv('CONTENT_ENRICHMENT_BATCH_LIMIT', '250'))
# Wall-clock budget for this stage. Rows not reached are deferred to the backfill.
STAGE_MAX_SECONDS = float(os.getenv('ENRICHMENT_STAGE_MAX_SECONDS', '900'))
REQUEST_TIMEOUT_S = 30
MIN_OVERVIEW_WORDS = 60
MAX_OVERVIEW_WORDS = 220
SYSTEM_PROMPT = 'You write short, factual overview blurbs for job/internship listing pages on an Indian internship-and-jobs platform. You are given the raw scraped title, company, location, and description for one listing. Write 120-220 words of original, specific copy covering: what the company does (if inferable from its name/domain — say \'a company in <space>\' if not confidently known, never invent a specific product or history you\'re not given), what the role likely involves day to day based on the title/description, and what kind of candidate it suits. \n\nHard rules: never invent salary, stipend, deadline, headcount, or eligibility criteria that aren\'t present in the input — omit them rather than guess. Never claim the company has a specific culture, award, or perk you weren\'t told about. Write in plain, direct prose, not marketing fluff or listicle language. No headers, no bullet points, no emoji. Do not repeat the title or company name as a heading — start straight into the content. \n\nRespond with strict JSON only, no markdown fences: {"overview": "...", "keywords": ["...", "..."]}. keywords should be 5-10 lowercase phrases relevant to the role (skills, role type, seniority, domain) suitable for internal search — not generic filler like \'job\' or \'career\'.'


def _extract_json(raw: str) -> Optional[dict]:
    raw = (raw or '').strip()
    fence_match = re.search('```(?:json)?\\s*(\\{.*?\\})\\s*```', raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None


def _parse_overview(content: str, model_hint: str) -> Optional[Dict]:
    parsed = _extract_json(content)
    if not isinstance(parsed, dict):
        log.warning('Could not parse provider JSON output')
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
    return {'overview': overview, 'keywords': keywords[:10], 'model': model_hint}


def _call_ai(client: LLMClient, title: str, company: str, location: str, description: str, job_type: str) -> Optional[Dict]:
    user_prompt = '\n'.join([f'Title: {title}', f'Company: {company}', f'Location: {location or "not specified"}', f'Listing type: {job_type or "not specified"}', "Original description (may be short or messy — it's raw scraped text):", (description or '(no description provided)').strip()[:4000]])
    # One re-ask on unusable output (too short / bad JSON); transport retries live in the client.
    for _ in range(2):
        content = client.complete(SYSTEM_PROMPT, user_prompt, temperature=0.4, timeout_s=REQUEST_TIMEOUT_S)
        if content is None:
            return None
        result = _parse_overview(content, client.last_model or 'unknown')
        if result:
            return result
    return None


def _write_enrichment(job_id: str, overview: str, keywords: List[str], model: str) -> None:
    conn = get_pg_conn()
    cursor = conn.cursor()
    cursor.execute('\n        UPDATE jobs\n        SET enriched_overview = %s,\n            enriched_keywords = %s,\n            enriched_model = %s,\n            enriched_at = now()\n        WHERE id = %s\n        ', (overview, keywords, model, job_id))
    conn.commit()
    cursor.close()


def run_content_enrichment_for_new_jobs(jobs: List[Dict], bulk: bool=False, client: Optional[LLMClient]=None) -> Dict:
    candidate_jobs = jobs if bulk else [j for j in jobs if j.get('id') and len(str(j.get('description') or '')) < THIN_DESCRIPTION_CHARS]
    candidate_jobs = [j for j in candidate_jobs if j.get('id')]
    # Thinnest-description first (lowest quality_score as tiebreak) so a capped batch spends its
    # budget on the jobs that need it most.
    candidate_jobs.sort(key=lambda j: (len(str(j.get('description') or '')), j.get('quality_score', 100)))
    batch = candidate_jobs[:BATCH_LIMIT]
    client = client or LLMClient(deadline=time.monotonic() + STAGE_MAX_SECONDS)
    if not batch:
        return {'enabled': client.enabled, 'attempted': 0, 'ai_enriched': 0, 'template_fallback': 0, 'deferred': 0, 'enriched': 0}
    if not client.enabled:
        log.warning('No content-enrichment provider configured (GROQ_API_KEY / GEMINI_API_KEY / NVIDIA_API_KEY all unset) — %d listing(s) left for the backfill.', len(batch))
        return {'enabled': False, 'attempted': 0, 'ai_enriched': 0, 'template_fallback': 0, 'deferred': len(batch), 'enriched': 0}
    log.info('Automatic content enrichment: %d listing(s) (capped at %d, bulk=%s, thinnest-first, providers=%s, budget=%.0fs)', len(batch), BATCH_LIMIT, bulk, client.provider_names(), STAGE_MAX_SECONDS)
    ai_enriched = attempted = 0
    for job in batch:
        if client.exhausted:
            log.warning('Content enrichment stopping early: providers rate-limited/unavailable beyond this stage\'s limits.')
            break
        attempted += 1
        try:
            result = _call_ai(client, title=job.get('title', ''), company=job.get('company', ''), location=job.get('location', ''), description=job.get('description', ''), job_type=job.get('type', ''))
            if result:
                _write_enrichment(job['id'], result['overview'], result['keywords'], result['model'])
                ai_enriched += 1
        except Exception:
            log.exception('Content enrichment failed for job id=%s', job.get('id'))
    deferred = len(batch) - ai_enriched
    log.info('Automatic content enrichment done: %d/%d AI-enriched, %d deferred to the backfill', ai_enriched, len(batch), deferred)
    return {'enabled': True, 'attempted': attempted, 'ai_enriched': ai_enriched, 'template_fallback': 0, 'deferred': deferred, 'enriched': ai_enriched}
