# Module: processors/india_filter.py
#
# InternFlow serves job seekers in India. This drops every scraped listing that
# is not located in India (or is not a remote role open to India), before
# anything is written to the database.
#
# Why this exists: normalizer.py defaults `country` to 'India' for any
# non-remote job, so global ATS boards (Greenhouse/Lever/Ashby...) used to
# land San Francisco or Berlin postings on the site labelled as Indian jobs.

import re
from typing import Dict, List, Tuple

# Sources that only ever list Indian jobs, so an empty/odd location is still India.
INDIA_ONLY_SOURCES = {
    'internshala', 'naukri', 'unstop', 'cutshort', 'freejobalert',
    'employment_news', 'company_portals', 'prosple',
}

_INDIA_PLACES = [
    'india', 'bharat',
    # metros / IT hubs
    'bangalore', 'bengaluru', 'mumbai', 'bombay', 'navi mumbai', 'thane', 'delhi', 'new delhi', 'ncr',
    'noida', 'greater noida', 'gurgaon', 'gurugram', 'faridabad', 'ghaziabad', 'hyderabad', 'secunderabad',
    'pune', 'chennai', 'madras', 'kolkata', 'calcutta', 'ahmedabad', 'gandhinagar', 'kochi', 'cochin',
    'thiruvananthapuram', 'trivandrum', 'coimbatore', 'madurai', 'mysore', 'mysuru', 'mangalore', 'mangaluru',
    'jaipur', 'indore', 'bhopal', 'nagpur', 'nashik', 'lucknow', 'kanpur', 'chandigarh', 'mohali', 'panchkula',
    'bhubaneswar', 'visakhapatnam', 'vizag', 'vijayawada', 'guntur', 'warangal', 'vadodara', 'baroda', 'surat',
    'rajkot', 'patna', 'ranchi', 'jamshedpur', 'raipur', 'dehradun', 'guwahati', 'goa', 'panaji', 'hubli',
    'belgaum', 'belagavi', 'tiruchirappalli', 'trichy', 'salem', 'vellore', 'pondicherry', 'puducherry',
    'amritsar', 'ludhiana', 'jalandhar', 'varanasi', 'prayagraj', 'allahabad', 'agra', 'meerut', 'udaipur',
    'jodhpur', 'kota', 'aurangabad', 'kolhapur', 'manipal', 'gwalior', 'jabalpur', 'siliguri', 'durgapur',
    # states / UTs
    'karnataka', 'maharashtra', 'tamil nadu', 'telangana', 'andhra pradesh', 'kerala', 'gujarat',
    'rajasthan', 'uttar pradesh', 'madhya pradesh', 'west bengal', 'haryana', 'punjab', 'odisha', 'orissa',
    'bihar', 'jharkhand', 'chhattisgarh', 'uttarakhand', 'himachal pradesh', 'assam', 'jammu', 'kashmir',
]
_INDIA_RE = re.compile(r'\b(' + '|'.join(re.escape(p) for p in sorted(_INDIA_PLACES, key=len, reverse=True)) + r')\b', re.I)
# "Remote" with no country, "Work from home", "Anywhere" from an India-only source still counts as India.
_GENERIC_REMOTE_RE = re.compile(r'^\s*(remote|work from home|wfh|anywhere|pan india|multiple locations?)\s*$', re.I)


def is_india_job(job: Dict) -> bool:
    if job.get('is_government'):
        return True
    source = str(job.get('source') or '').lower()
    haystack = ' '.join(str(job.get(k) or '') for k in ('location', 'normalized_location'))
    if _INDIA_RE.search(haystack):
        return True
    country = str(job.get('country') or '').strip().lower()
    if source in INDIA_ONLY_SOURCES or source.startswith('company_portal'):
        loc = str(job.get('location') or '').strip()
        return not loc or bool(_GENERIC_REMOTE_RE.match(loc)) or country in ('', 'india')
    return False


def filter_india(jobs: List[Dict]) -> Tuple[List[Dict], int]:
    kept: List[Dict] = []
    for job in jobs:
        if is_india_job(job):
            job['country'] = 'India'
            kept.append(job)
    return kept, len(jobs) - len(kept)
