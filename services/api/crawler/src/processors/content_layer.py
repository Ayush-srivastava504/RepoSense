# Module: crawler/src/processors/content_layer.py
# Runs after quality.py's filter_and_score(), before the DB write. Decides
# how much page content a job earns based on the trust/quality signals
# quality.py already computed -- not every kept job gets the same
# treatment, so LLM spend tracks confidence, not raw crawl volume.
#
# Defines: content_tier, build_faq, build_table, segment_key

from typing import Dict, List
import re

CONTENT_TIERS = ('full', 'standard', 'table_only')


def content_tier(job: Dict) -> str:
    """Gate content depth on signals quality.py already produced.
    'full'       -> unique LLM overview + FAQ + chart + table
    'standard'   -> templated overview + FAQ + table, shared chart only
    'table_only' -> structured facts only; excluded from FAQPage schema
                    (a low-confidence FAQ answer is worse for trust/SEO
                    than no FAQ at all)
    """
    if job.get('legitimacy_state') == 'verified' and not job.get('is_thin'):
        return 'full'
    if job.get('legitimacy_state') in ('verified', 'likely'):
        return 'standard'
    return 'table_only'


def _is_remote(location: str) -> bool:
    return bool(re.search(r'\bremote\b', location or '', re.IGNORECASE))


def build_table(job: Dict) -> List[Dict[str, str]]:
    """Structured facts. No LLM -- straight field extraction, same
    pattern as quality.py's deterministic checks."""
    comp = job.get('salary') or job.get('stipend') or 'Not disclosed'
    return [
        {'label': 'Role', 'value': job.get('title', '')},
        {'label': 'Company', 'value': job.get('company', '')},
        {'label': 'Location', 'value': job.get('location', '')},
        {'label': 'Type', 'value': job.get('job_type', '')},
        {'label': 'Compensation', 'value': comp},
        {'label': 'Posted', 'value': job.get('posted_date', '')},
        {'label': 'Deadline', 'value': job.get('deadline', '') or 'Rolling'},
    ]


def build_faq(job: Dict) -> List[Dict[str, str]]:
    """Templated questions, slot-filled answers. Only called for
    'full'/'standard' tier jobs. Each answer is deterministic from fields
    already on the job -- the per-job LLM call only rewrites these into
    natural prose, it doesn't invent the underlying facts, so a
    hallucinated FAQ answer isn't possible from this layer."""
    title, company, location = job.get('title', ''), job.get('company', ''), job.get('location', '')
    comp = job.get('salary') or job.get('stipend')
    return [
        {
            'q': f'Is the {title} role at {company} remote, hybrid, or onsite?',
            'a_fact': 'remote' if _is_remote(location) else f'based in {location}',
        },
        {
            'q': f'Is the {title} position at {company} paid?',
            'a_fact': f'compensation disclosed: {comp}' if comp else 'compensation not disclosed by the employer',
        },
        {
            'q': f'What is the application deadline for this {title} role?',
            'a_fact': job.get('deadline') or 'no fixed deadline listed; applications reviewed on a rolling basis',
        },
    ]


def segment_key(job: Dict) -> str:
    """Which shared, nightly-computed chart this page points at. Chart
    data itself is NOT built here -- it's a separate aggregate job over
    the jobs table, keyed the same way, so many pages share one real,
    accurate chart instead of each page fabricating its own."""
    role_bucket = job.get('title', '').split()[0].lower() if job.get('title') else 'general'
    loc_bucket = 'remote' if _is_remote(job.get('location', '')) else (job.get('location', '').split(',')[0].lower() or 'india')
    return f"{job.get('job_type', '')}:{role_bucket}:{loc_bucket}"


def attach_content_plan(job: Dict) -> Dict:
    """Convenience entry point: mutates and returns job with tier +
    table + faq (when earned) + segment_key attached, ready for the DB
    write. Call this on each item in quality.py's `kept` list."""
    tier = content_tier(job)
    job['content_tier'] = tier
    job['content_table'] = build_table(job)
    job['content_faq'] = build_faq(job) if tier in ('full', 'standard') else []
    job['segment_key'] = segment_key(job)
    return job
