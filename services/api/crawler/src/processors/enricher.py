# Module: crawler/src/processors/enricher.py
# Defines function(s): enrich, enrich_batch, _enrich_single, _classify_category, _extract_skills, _parse_money_range, _parse_experience, _deadline_soon
#
#

import re
from typing import Dict, List, Optional, Tuple
from utils import get_logger
log = get_logger('enricher')
CATEGORY_RULES: List[Tuple[str, List[str]]] = [('Software Engineering', ['software', 'developer', 'engineer', 'sde', 'backend', 'frontend', 'fullstack', 'full stack', 'web dev', 'application', 'system analyst', 'systems analyst']), ('Data Science & ML', ['data scien', 'machine learning', 'deep learning', 'ml engineer', 'nlp', 'computer vision', 'ai research', 'data analyst']), ('DevOps & Cloud', ['devops', 'cloud', 'infrastructure', 'sre', 'reliability', 'kubernetes', 'docker', 'aws', 'azure', 'gcp']), ('Sales', ['sales executive', 'sales representative', 'sales manager', 'business development', 'account executive', 'account manager', 'bdr', 'sdr', 'inside sales', 'field sales', 'pre-sales', 'presales', 'sales associate', 'territory manager', 'channel sales', 'revenue growth']), ('Finance', ['finance', 'financial analyst', 'accountant', 'accounting', 'audit', 'auditor', 'taxation', 'tax analyst', 'investment banking', 'equity research', 'credit analyst', 'treasury', 'bookkeeping', 'financial planning', 'fp&a', 'controller', 'chartered accountant'])]
CATEGORY_TO_GROUP: Dict[str, str] = {'Software Engineering': 'software', 'Data Science & ML': 'software', 'DevOps & Cloud': 'software', 'Sales': 'sales', 'Finance': 'finance'}
SKILL_PATTERNS: List[Tuple[str, str]] = [('\\bpython\\b', 'Python'), ('\\bjava\\b(?!script)', 'Java'), ('\\bjavascript\\b|\\bjs\\b', 'JavaScript'), ('\\btypescript\\b|\\bts\\b', 'TypeScript'), ('\\bc\\+\\+\\b|\\bcpp\\b', 'C++'), ('\\breact(?:\\.?js)?\\b', 'React'), ('\\bnode(?:\\.?js)?\\b', 'Node.js'), ('\\bdjango\\b', 'Django'), ('\\bflask\\b', 'Flask'), ('\\bfastapi\\b', 'FastAPI'), ('\\btensorflow\\b|\\btf\\b', 'TensorFlow'), ('\\bpytorch\\b', 'PyTorch'), ('\\bpandas\\b', 'Pandas'), ('\\bnumpy\\b', 'NumPy'), ('\\bmysql\\b', 'MySQL'), ('\\bpostgresql\\b|\\bpostgres\\b', 'PostgreSQL'), ('\\bmongodb\\b', 'MongoDB'), ('\\bredis\\b', 'Redis'), ('\\baws\\b', 'AWS'), ('\\bazure\\b', 'Azure'), ('\\bdocker\\b', 'Docker'), ('\\bkubernetes\\b|\\bk8s\\b', 'Kubernetes'), ('\\bspark\\b', 'Apache Spark'), ('\\bkafka\\b', 'Kafka'), ('\\bairflow\\b', 'Airflow')]

def enrich(job: Dict) -> Dict:
    try:
        _enrich_single(job)
    except Exception as exc:
        log.warning('Enrichment error for %s: %s', job.get('id', '?'), exc)
    return job

def enrich_batch(jobs: List[Dict]) -> List[Dict]:
    for job in jobs:
        enrich(job)
    log.info('Enriched %d jobs', len(jobs))
    return jobs

def _enrich_single(job: Dict) -> None:
    text_corpus = ' '.join([job.get('title', ''), job.get('description', ''), ' '.join(job.get('skills', [])), ' '.join(job.get('requirements', []))]).lower()
    if not job.get('category'):
        job['category'] = _classify_category(text_corpus)
    if not job.get('job_group'):
        job['job_group'] = CATEGORY_TO_GROUP.get(job['category'], 'other')
    extracted_skills = _extract_skills(text_corpus)
    existing_skills = {skill.lower() for skill in job.get('skills', [])}
    merged_skills = list(job.get('skills', [])) + [skill for skill in extracted_skills if skill.lower() not in existing_skills]
    job['skills'] = merged_skills[:30]
    job['salary_range'] = _parse_money_range(job.get('salary', ''))
    job['stipend_range'] = _parse_money_range(job.get('stipend', ''))
    job['is_deadline_soon'] = _deadline_soon(job.get('deadline', ''))
    if job.get('is_remote') and (not job.get('location')):
        job['location'] = 'Remote'
    if not job.get('experience_range'):
        job['experience_range'] = _parse_experience(job.get('experience_required', '') + ' ' + text_corpus)

def _classify_category(text: str) -> str:
    for category, keywords in CATEGORY_RULES:
        for keyword in keywords:
            if keyword in text:
                return category
    return 'Other'

def _extract_skills(text: str) -> List[str]:
    found = []
    for pattern, skill_name in SKILL_PATTERNS:
        if re.search(pattern, text, re.I):
            found.append(skill_name)
    return found

def _parse_money_range(value: str) -> Optional[Dict]:
    if not value:
        return None
    value = str(value)
    currency = 'INR'
    if '$' in value:
        currency = 'USD'
    elif '€' in value:
        currency = 'EUR'
    numbers = re.findall('[\\d,]+(?:\\.\\d+)?', value.replace(',', ''))
    numbers = [float(number) for number in numbers if number]
    if not numbers:
        return None
    unit = 'month'
    if re.search('\\bLPA\\b|\\bper\\s*ann', value, re.I):
        unit = 'year_lakh'
    elif re.search('\\bper\\s*hour\\b|\\bhour\\b', value, re.I):
        unit = 'hour'
    elif re.search('\\bper\\s*day\\b|\\bdaily\\b', value, re.I):
        unit = 'day'
    if len(numbers) >= 2:
        return {'min': min(numbers[:2]), 'max': max(numbers[:2]), 'currency': currency, 'unit': unit}
    return {'min': numbers[0], 'max': None, 'currency': currency, 'unit': unit}

def _parse_experience(text: str) -> Optional[Dict]:
    match = re.search('(\\d+)\\s*[-–to]+\\s*(\\d+)\\s*(?:year|yr)', text, re.I)
    if match:
        return {'min_years': int(match.group(1)), 'max_years': int(match.group(2))}
    match = re.search('(\\d+)\\+\\s*(?:year|yr)', text, re.I)
    if match:
        return {'min_years': int(match.group(1)), 'max_years': None}
    if re.search('\\bfresher\\b|\\b0\\s*year', text, re.I):
        return {'min_years': 0, 'max_years': 0}
    return None

def _deadline_soon(deadline: str) -> bool:
    if not deadline:
        return False
    try:
        from datetime import datetime, timezone
        deadline_datetime = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
        delta = deadline_datetime - datetime.now(timezone.utc)
        return 0 < delta.days <= 7
    except Exception:
        return False
