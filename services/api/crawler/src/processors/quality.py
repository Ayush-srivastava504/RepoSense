# Module: crawler/src/processors/quality.py
# Ported from FresherFlow's legitimacy-detector.service.ts +
# extractor.ts's isRejectedApplyUrl/isListingUrl. RepoSense's pipeline
# previously had zero quality gate: any scraped job — even one with a
# 20-character description and a dead-end apply link — flowed straight
# from normalize -> dedupe -> enrich -> trust -> DB write.
#
# This module runs right before the DB write and does two things:
#   1. HARD REJECTS jobs whose apply URL can never be a real posting
#      (homepage, search page, listing page, blog, govt portal, etc.)
#   2. For everything that survives, computes a deterministic
#      legitimacy_state (verified / likely / uncertain) + is_thin flag +
#      quality_score, so thin-but-real postings get FLAGGED for
#      priority enrichment instead of silently published as-is.
#
# Defines function(s): is_rejected_apply_url, is_listing_url,
#   assess_legitimacy, filter_and_score

from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
from utils import get_logger

log = get_logger('quality')

# --- URL rejection -----------------------------------------------------

LISTING_PATH_SEGMENTS = {
    'jobs', 'job', 'jops', 'jobss',
    'careers', 'career', 'carrers', 'carrer', 'carreers', 'carreer',
    'drives', 'drive', 'off-campus', 'offcampus', 'offcampusdrive',
    'search', 'auth', 'signin', 'signup', 'register', 'registration', 'home', 'welcome',
    'opportunities', 'openings', 'vacancy', 'vacancies', 'find-jobs', 'job-search', 'jobsearch',
    'notifications', 'notification', 'results', 'result', 'apply-online', 'applyonline',
}

# Kept intentionally aligned with trust.py's AGGREGATOR_DOMAINS so the two
# modules don't quietly diverge on what counts as an aggregator.
AGGREGATOR_DOMAINS = {
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com', 'internshala.com',
    'unstop.com', 'cutshort.in', 'freejobalert.com', 'remoteok.com', 'remoteok.io',
    'weworkremotely.com', 'remotive.com', 'wayup.com', 'hiring.cafe', 'jobicy.com',
    'arbeitnow.com',
}

GOVT_TLD_HINTS = ('.gov.in', '.nic.in', '.gov')

KNOWN_ATS_HOSTS = {
    'greenhouse.io', 'boards.greenhouse.io', 'lever.co', 'jobs.lever.co',
    'myworkdayjobs.com', 'workday.com', 'smartrecruiters.com', 'bamboohr.com',
    'icims.com', 'successfactors.com', 'oraclecloud.com', 'ashbyhq.com',
    'jobs.ashbyhq.com', 'zohorecruit.com', 'freshteam.com', 'recruitee.com',
    'workable.com', 'breezy.hr', 'jazzhr.com', 'taleo.net', 'paylocity.com',
}


def _host_of(url: str) -> str:
    try:
        host = urlparse(url).hostname or ''
        return host.lower().lstrip('www.') if host.lower().startswith('www.') else host.lower()
    except Exception:
        return ''


def _is_govt_domain(host: str) -> bool:
    return any(host.endswith(hint) for hint in GOVT_TLD_HINTS)


def _is_aggregator_domain(host: str) -> bool:
    return any(host == d or host.endswith('.' + d) for d in AGGREGATOR_DOMAINS)


def _is_ats_host(host: str) -> bool:
    return any(host == d or host.endswith('.' + d) for d in KNOWN_ATS_HOSTS)


def is_listing_url(parsed) -> bool:
    path = parsed.path.rstrip('/')
    if not path:
        return True  # bare domain root — not a specific job
    segments = [s for s in path.split('/') if s]
    last = segments[-1].lower() if segments else ''
    if last in LISTING_PATH_SEGMENTS:
        # Allow listing-looking paths that carry an explicit job identifier
        # in the query (e.g. .../job/home?job_id=32120 is a real job).
        q = (parsed.query or '').lower()
        import re as _re
        if _re.search(r'job[_-]?id|jobcode|jobcodeid|requisition[_-]?id|req[_-]?id|position[_-]?id|jobdriveid', q):
            return False
        return True
    return False


def is_rejected_apply_url(url_str: str) -> Tuple[bool, Optional[str]]:
    """Returns (rejected, reason). True when the URL must never become a
    published job: malformed, govt portal, generic listing page,
    blog/document content, or a known aggregator/blocked domain."""
    if not url_str:
        return True, 'missing apply_url'
    try:
        parsed = urlparse(url_str)
        host = _host_of(url_str)
        if not host or '.' not in host:
            return True, 'malformed host'
        if _is_govt_domain(host):
            return True, 'govt portal domain'
        if is_listing_url(parsed):
            return True, 'apply_url points at a listing/search/home page, not a specific posting'
        if _is_aggregator_domain(host):
            return True, 'apply_url points back at an aggregator rather than the actual posting'
        if host == 'drive.google.com':
            return True, 'apply_url is a document link, not an application'
        segments = [s for s in parsed.path.lower().split('/') if s]
        if any(s in ('blog', 'blogs') for s in segments):
            return True, 'apply_url is blog/article content'
        hyphen_tokens = [t for s in segments for t in s.split('-')]
        if any(t in ('blog', 'blogs') for t in hyphen_tokens):
            career_segments = {'careers', 'career', 'jobs', 'job', 'apply'}
            if not _is_ats_host(host) and not any(s in career_segments for s in segments):
                return True, 'apply_url is blog/article content'
        if 'expired_jd_redirect' in url_str.lower():
            return True, 'apply_url carries an expired-redirect marker'
    except Exception:
        return True, 'apply_url failed to parse'
    return False, None


# --- Legitimacy assessment (ported from legitimacy-detector.service.ts) --

LEGITIMACY_STATES = ('verified', 'likely', 'uncertain')
THIN_DESCRIPTION_THRESHOLD = 300  # chars — matches FresherFlow's cutoff


def assess_legitimacy(job: Dict, source_count: int = 1) -> Dict:
    """Deterministic, explainable posting-legitimacy scorer. Pure, never
    throws. 'uncertain' is the conservative default; 'verified' requires
    strong corroboration. Mirrors legitimacy-detector.service.ts 1:1."""
    checked_at = datetime.now(timezone.utc).isoformat(timespec='seconds')
    description = job.get('description') or ''
    desc_len = len(description)
    apply_url = job.get('apply_url') or job.get('url') or ''
    host = _host_of(apply_url)
    is_from_ats = _is_ats_host(host)
    has_compensation = bool((job.get('salary') or job.get('stipend') or '').strip())
    redirects_off_platform = bool(job.get('_redirects_off_platform', False))

    if redirects_off_platform:
        return {'state': 'uncertain', 'reasons': ['Apply URL redirects off-platform.'], 'checked_at': checked_at}

    if source_count >= 3:
        return {'state': 'verified', 'reasons': [f'Observed on {source_count} independent sources.'], 'checked_at': checked_at}
    if is_from_ats and has_compensation:
        return {'state': 'verified', 'reasons': ['Sourced from an ATS with disclosed compensation.'], 'checked_at': checked_at}

    reasons: List[str] = []
    concerns = 0
    if not has_compensation:
        reasons.append('No compensation disclosed.')
        concerns += 1
    if desc_len < THIN_DESCRIPTION_THRESHOLD:
        reasons.append('Very thin job description.')
        concerns += 1
    if not job.get('company'):
        reasons.append('Sparse company profile.')
        concerns += 1

    has_positive_signal = is_from_ats or source_count >= 2 or has_compensation
    if is_from_ats:
        reasons.append('Sourced from an ATS.')
    if source_count >= 2:
        reasons.append(f'Observed on {source_count} sources.')

    if concerns >= 2 and not has_positive_signal:
        return {'state': 'uncertain', 'reasons': reasons, 'checked_at': checked_at}
    if has_positive_signal:
        return {'state': 'likely', 'reasons': reasons or ['Has compensation and a substantive description.'], 'checked_at': checked_at}
    return {'state': 'uncertain', 'reasons': reasons, 'checked_at': checked_at}


# --- Entry point ---------------------------------------------------------

def filter_and_score(jobs: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """Splits jobs into (kept, rejected). `kept` jobs get
    legitimacy_state, quality_score, and is_thin attached so the DB write
    and enrichment prioritization can act on them; nothing is silently
    dropped without a reason."""
    kept: List[Dict] = []
    rejected: List[Dict] = []
    seen_apply_urls: Dict[str, int] = {}
    for job in jobs:
        apply_url = job.get('apply_url') or job.get('url') or ''
        seen_apply_urls[apply_url] = seen_apply_urls.get(apply_url, 0) + 1

    for job in jobs:
        apply_url = job.get('apply_url') or job.get('url') or ''
        bad, reason = is_rejected_apply_url(apply_url)
        if bad:
            job['_rejection_reason'] = reason
            rejected.append(job)
            continue
        source_count = seen_apply_urls.get(apply_url, 1)
        verdict = assess_legitimacy(job, source_count=source_count)
        desc_len = len(job.get('description') or '')
        is_thin = desc_len < THIN_DESCRIPTION_THRESHOLD
        # quality_score: simple 0-100 composite, cheap to compute, useful
        # for sorting enrichment priority (thinnest/lowest first).
        score = 40
        if verdict['state'] == 'verified':
            score += 40
        elif verdict['state'] == 'likely':
            score += 20
        if not is_thin:
            score += 20
        score = max(0, min(100, score))
        job['legitimacy_state'] = verdict['state']
        job['legitimacy_reasons'] = verdict['reasons']
        job['is_thin'] = is_thin
        job['quality_score'] = score
        kept.append(job)

    if rejected:
        reasons_summary: Dict[str, int] = {}
        for r in rejected:
            reasons_summary[r.get('_rejection_reason', 'unknown')] = reasons_summary.get(r.get('_rejection_reason', 'unknown'), 0) + 1
        log.info('Quality gate: rejected %d/%d jobs | reasons=%s', len(rejected), len(jobs), reasons_summary)
    thin_kept = sum(1 for j in kept if j.get('is_thin'))
    log.info('Quality gate: kept %d jobs (%d flagged thin) | legitimacy=%s', len(kept), thin_kept,
             {s: sum(1 for j in kept if j.get('legitimacy_state') == s) for s in LEGITIMACY_STATES})
    return kept, rejected
