# Shared sourcing helpers for the Europe scrapers (europe_jobicy.py,
# europe_arbeitnow.py, europe_remoteok.py, europe_remotive.py,
# europe_weworkremotely.py).
# Every source function here was independently checked before being wired

import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional
import requests
REMOTEOK_API_URL = 'https://remoteok.com/api'
JOBICY_API_URL = 'https://jobicy.com/api/v2/remote-jobs'
ARBEITNOW_API_URL = 'https://arbeitnow.com/api/job-board-api'
REMOTIVE_API_URL = 'https://remotive.com/api/remote-jobs'
WEWORKREMOTELY_RSS_URL = 'https://weworkremotely.com/remote-jobs.rss'
REQUEST_TIMEOUT = 30
EUROPE_HINTS = ('europe', 'european', 'emea', 'eu ', ' eu', 'uk', 'united kingdom', 'britain', 'england', 'scotland', 'wales', 'ireland', 'germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt', 'cologne', 'köln', 'france', 'paris', 'lyon', 'spain', 'españa', 'madrid', 'barcelona', 'italy', 'italia', 'rome', 'milan', 'milano', 'netherlands', 'amsterdam', 'rotterdam', 'the hague', 'belgium', 'brussels', 'antwerp', 'portugal', 'lisbon', 'lisboa', 'porto', 'switzerland', 'zurich', 'zürich', 'geneva', 'austria', 'vienna', 'wien', 'poland', 'warsaw', 'warszawa', 'krakow', 'kraków', 'sweden', 'stockholm', 'norway', 'oslo', 'denmark', 'copenhagen', 'finland', 'helsinki', 'czechia', 'czech republic', 'prague', 'praha', 'hungary', 'budapest', 'romania', 'bucharest', 'greece', 'athens', 'croatia', 'zagreb', 'bulgaria', 'sofia', 'slovakia', 'bratislava', 'slovenia', 'ljubljana', 'estonia', 'tallinn', 'latvia', 'riga', 'lithuania', 'vilnius', 'ukraine', 'kyiv', 'kiev', 'serbia', 'belgrade')

def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9'})
    return session

def _clean(value) -> str:
    return re.sub('\\s+', ' ', str(value or '')).strip()

def _looks_european(text: str) -> bool:
    lower = f' {text.lower()} '
    return any((hint in lower for hint in EUROPE_HINTS))

def _job_type_from_text(text: str) -> str:
    lower = text.lower()
    if 'intern' in lower:
        return 'internship'
    if 'contract' in lower or 'freelance' in lower:
        return 'contract'
    if 'part' in lower or 'teilzeit' in lower:
        return 'part-time'
    return 'full-time'

def fetch_jobicy_europe_entries(session: requests.Session, log) -> List[Dict]:
    try:
        response = session.get(JOBICY_API_URL, params={'count': 100, 'geo': 'europe'}, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.RequestException as exc:
        log.warning('Europe/Jobicy request failed: %s', exc)
        return []
    if response.status_code != 200:
        log.warning('Europe/Jobicy HTTP failure %d', response.status_code)
        return []
    try:
        data = response.json()
    except ValueError:
        return []
    jobs = data.get('jobs') if isinstance(data, dict) else None
    if not isinstance(jobs, list):
        return []
    return [row for row in jobs if isinstance(row, dict)]

def parse_jobicy_entry(entry: Dict) -> Optional[Dict]:
    title = _clean(entry.get('jobTitle'))
    company = _clean(entry.get('companyName'))
    apply_url = _clean(entry.get('url'))
    if not title or not company or (not apply_url):
        return None
    job_types = entry.get('jobType')
    job_types_text = ' '.join((_clean(t) for t in job_types)) if isinstance(job_types, list) else _clean(job_types)
    job_type = _job_type_from_text(f'{job_types_text} {title}')
    industries = entry.get('jobIndustry')
    skills = [_clean(i) for i in industries if _clean(i)] if isinstance(industries, list) else []
    salary = ''
    salary_min = entry.get('salaryMin')
    salary_max = entry.get('salaryMax')
    salary_currency = _clean(entry.get('salaryCurrency'))
    if salary_min and salary_max:
        salary = f'{salary_currency} {salary_min}-{salary_max}'.strip()
    elif salary_min:
        salary = f'{salary_currency} {salary_min}+'.strip()
    description = _clean(entry.get('jobExcerpt') or entry.get('jobDescription'))
    location = _clean(entry.get('jobGeo')) or 'Europe'
    return {'title': title, 'company': company, 'location': location, 'type': job_type, 'salary': salary, 'description': description[:5000], 'skills': skills, 'apply_url': apply_url, 'posted_date': _clean(entry.get('pubDate')), 'is_remote': True, 'country': 'Europe'}

def fetch_arbeitnow_entries(session: requests.Session, log) -> List[Dict]:
    try:
        response = session.get(ARBEITNOW_API_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.RequestException as exc:
        log.warning('Europe/Arbeitnow request failed: %s', exc)
        return []
    if response.status_code != 200:
        log.warning('Europe/Arbeitnow HTTP failure %d', response.status_code)
        return []
    try:
        data = response.json()
    except ValueError:
        return []
    rows = data.get('data') if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]

def parse_arbeitnow_entry(entry: Dict) -> Optional[Dict]:
    title = _clean(entry.get('title'))
    company = _clean(entry.get('company_name'))
    apply_url = _clean(entry.get('url'))
    if not title or not company or (not apply_url):
        return None
    location = _clean(entry.get('location')) or 'Europe'
    tags = entry.get('tags')
    skills = [_clean(t) for t in tags if _clean(t)] if isinstance(tags, list) else []
    job_types = entry.get('job_types')
    job_types_text = ' '.join((_clean(t) for t in job_types)) if isinstance(job_types, list) else ''
    job_type = _job_type_from_text(f'{job_types_text} {title}')
    description = re.sub('<[^>]+>', ' ', _clean(entry.get('description')))
    description = re.sub('\\s+', ' ', description).strip()
    return {'title': title, 'company': company, 'location': location, 'type': job_type, 'salary': '', 'description': description[:5000], 'skills': skills, 'apply_url': apply_url, 'posted_date': '', 'is_remote': bool(entry.get('remote')), 'country': 'Europe'}

def fetch_remotive_europe_entries(session: requests.Session, log) -> List[Dict]:
    try:
        response = session.get(REMOTIVE_API_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.RequestException as exc:
        log.warning('Europe/Remotive request failed: %s', exc)
        return []
    if response.status_code != 200:
        log.warning('Europe/Remotive HTTP failure %d', response.status_code)
        return []
    try:
        data = response.json()
    except ValueError:
        return []
    jobs = data.get('jobs') if isinstance(data, dict) else None
    if not isinstance(jobs, list):
        return []
    matched = []
    for entry in jobs:
        if not isinstance(entry, dict):
            continue
        haystack = ' '.join([_clean(entry.get('candidate_required_location')), _clean(entry.get('title'))])
        if _looks_european(haystack):
            matched.append(entry)
    return matched

def parse_remotive_entry(entry: Dict) -> Optional[Dict]:
    title = _clean(entry.get('title'))
    company = _clean(entry.get('company_name'))
    apply_url = _clean(entry.get('url'))
    if not title or not company or (not apply_url):
        return None
    tags = entry.get('tags')
    skills = [_clean(t) for t in tags if _clean(t)] if isinstance(tags, list) else []
    job_type = _job_type_from_text(f'{_clean(entry.get("job_type"))} {title}')
    location = _clean(entry.get('candidate_required_location')) or 'Europe'
    description = re.sub('<[^>]+>', ' ', _clean(entry.get('description')))
    description = re.sub('\\s+', ' ', description).strip()
    salary = _clean(entry.get('salary'))
    return {'title': title, 'company': company, 'location': location, 'type': job_type, 'salary': salary, 'description': description[:5000], 'skills': skills, 'apply_url': apply_url, 'posted_date': _clean(entry.get('publication_date')), 'is_remote': True, 'country': 'Europe'}

def fetch_weworkremotely_europe_entries(session: requests.Session, log) -> List[Dict]:
    try:
        response = session.get(WEWORKREMOTELY_RSS_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.RequestException as exc:
        log.warning('Europe/WeWorkRemotely request failed: %s', exc)
        return []
    if response.status_code != 200:
        log.warning('Europe/WeWorkRemotely HTTP failure %d', response.status_code)
        return []
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        log.warning('Europe/WeWorkRemotely RSS parse failed: %s', exc)
        return []
    matched = []
    for item in root.iter('item'):
        title = _clean(item.findtext('title'))
        link = _clean(item.findtext('link'))
        description = _clean(item.findtext('description'))
        if not title or not link:
            continue
        if _looks_european(f'{title} {description}'):
            matched.append({'title': title, 'link': link, 'description': description})
    return matched

def parse_weworkremotely_entry(entry: Dict) -> Optional[Dict]:
    raw_title = entry.get('title', '')
    link = entry.get('link', '')
    if not raw_title or not link:
        return None
    if ':' in raw_title:
        company, _, title = raw_title.partition(':')
        company = _clean(company)
        title = _clean(title)
    else:
        company = 'We Work Remotely'
        title = _clean(raw_title)
    if not title:
        title = _clean(raw_title)
    description = re.sub('<[^>]+>', ' ', entry.get('description', ''))
    description = re.sub('\\s+', ' ', description).strip()
    job_type = _job_type_from_text(f'{title} {description[:200]}')
    return {'title': title, 'company': company or 'We Work Remotely', 'location': 'Europe', 'type': job_type, 'salary': '', 'description': description[:5000], 'skills': [], 'apply_url': link, 'posted_date': '', 'is_remote': True, 'country': 'Europe'}

def fetch_remoteok_europe_entries(session: requests.Session, log) -> List[Dict]:
    try:
        response = session.get(REMOTEOK_API_URL, timeout=REQUEST_TIMEOUT, allow_redirects=True)
    except requests.RequestException as exc:
        log.warning('Europe/RemoteOK request failed: %s', exc)
        return []
    if response.status_code != 200:
        log.warning('Europe/RemoteOK HTTP failure %d', response.status_code)
        return []
    try:
        data = response.json()
    except ValueError:
        return []
    if not isinstance(data, list):
        return []
    matched = []
    for entry in data:
        if not isinstance(entry, dict) or not entry.get('id'):
            continue
        tags = entry.get('tags')
        tags_text = ' '.join((_clean(t) for t in tags)) if isinstance(tags, list) else ''
        haystack = ' '.join([_clean(entry.get('location')), tags_text, _clean(entry.get('position') or entry.get('title'))])
        if _looks_european(haystack):
            matched.append(entry)
    return matched

def parse_remoteok_entry(entry: Dict) -> Optional[Dict]:
    title = _clean(entry.get('position') or entry.get('title'))
    company = _clean(entry.get('company'))
    if not title or not company:
        return None
    apply_url = _clean(entry.get('url'))
    if not apply_url:
        slug = _clean(entry.get('slug'))
        if slug:
            apply_url = f'https://remoteok.com{slug}'
    if not apply_url:
        return None
    tags = entry.get('tags')
    skills = [_clean(t) for t in tags if _clean(t)] if isinstance(tags, list) else []
    location = _clean(entry.get('location')) or 'Europe'
    job_type = _job_type_from_text(title)
    return {'title': title, 'company': company, 'location': location, 'type': job_type, 'salary': '', 'description': _clean(entry.get('description')), 'skills': skills, 'apply_url': apply_url, 'posted_date': entry.get('date') or '', 'is_remote': True, 'country': 'Europe'}
