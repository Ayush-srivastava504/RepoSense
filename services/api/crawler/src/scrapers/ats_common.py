# Shared helpers for "smart" ATS scrapers.
# Unlike Himalayas/RemoteOK/etc (one global feed), Greenhouse, Lever, Ashby,
# SmartRecruiters, Workable, and Jobvite each host thousands of *separate*
# per-company job boards behind a public, unauthenticated JSON API. There is

import html
import re
import time
from typing import Dict, List, Optional
import requests
from utils import get_logger
log = get_logger('ats_common')
WHITESPACE_RE = re.compile('\\s+')
TAG_RE = re.compile('<[^>]+>')
DEFAULT_HEADERS = {'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'}

def clean(value) -> str:
    text = html.unescape(str(value or ''))
    text = TAG_RE.sub(' ', text)
    text = html.unescape(text)
    return WHITESPACE_RE.sub(' ', text).strip()

def infer_type(*texts: str) -> str:
    blob = ' '.join((t or '' for t in texts)).lower()
    if 'intern' in blob:
        return 'internship'
    if 'contract' in blob or 'freelance' in blob or 'temporary' in blob:
        return 'contract'
    if 'part-time' in blob or 'part time' in blob:
        return 'part-time'
    return 'full-time'

def fetch_json(session: requests.Session, url: str, params: Optional[Dict]=None, timeout: int=30, max_retries: int=3, backoff: float=2.0) -> Optional[Dict]:
    for attempt in range(1, max_retries + 1):
        try:
            response = session.get(url, params=params, headers=DEFAULT_HEADERS, timeout=timeout)
        except requests.RequestException as exc:
            log.warning('Request failed %s (attempt %d): %s', url, attempt, exc)
            time.sleep(backoff * attempt)
            continue
        if response.status_code == 404:
            log.info('404 (board not found) %s', url)
            return None
        if response.status_code in (429, 500, 502, 503, 504):
            wait = backoff * attempt
            log.warning('Retryable status %d for %s, waiting %.1fs', response.status_code, url, wait)
            time.sleep(wait)
            continue
        if response.status_code != 200:
            log.warning('HTTP %d for %s', response.status_code, url)
            return None
        try:
            return response.json()
        except ValueError as exc:
            content_type = response.headers.get('Content-Type', 'unknown')
            snippet = (response.text or '')[:200].replace('\n', ' ')
            log.warning('JSON decode failed for %s: %s | content-type=%s body[:200]=%r', url, exc, content_type, snippet)
            return None
    return None

def build_job(*, title: str, company: str, location: str, description: str='', apply_url: str, salary: str='', posted_date: str='', is_remote: Optional[bool]=None, job_type: Optional[str]=None, source: str) -> Optional[Dict]:
    title = clean(title)
    company = clean(company)
    apply_url = clean(apply_url)
    if not title or not company or (not apply_url):
        return None
    location = clean(location) or 'Unspecified'
    if is_remote is None:
        is_remote = 'remote' in location.lower()
    return {'title': title, 'company': company, 'location': location, 'type': job_type or infer_type(title, description), 'salary': salary, 'description': clean(description)[:5000], 'skills': [], 'apply_url': apply_url, 'posted_date': posted_date, 'is_remote': is_remote, 'country': location, 'source': source}

def dedupe(jobs: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for job in jobs:
        url = job.get('apply_url')
        if not url or url in seen:
            continue
        seen.add(url)
        out.append(job)
    return out
