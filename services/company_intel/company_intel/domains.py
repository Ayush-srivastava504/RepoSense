"""Domain helpers. NON_EMPLOYER_DOMAINS mirrors apps/web/lib/logoDomain.ts and
services/api/src/routes/companies.py: job boards / ATS hosts are never an employer's website."""
from typing import Optional
from urllib.parse import urlparse

NON_EMPLOYER_DOMAINS = (
    'linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com', 'internshala.com', 'unstop.com',
    'cutshort.in', 'freejobalert.com', 'remoteok.com', 'remoteok.io', 'weworkremotely.com',
    'remotive.com', 'wayup.com', 'hiring.cafe', 'jobicy.com', 'arbeitnow.com', 'wellfound.com',
    'angel.co', 'ycombinator.com', 'monster.com', 'ziprecruiter.com', 'simplyhired.com',
    'foundit.in', 'shine.com', 'apna.co', 'greenhouse.io', 'lever.co', 'myworkdayjobs.com',
    'workday.com', 'ashbyhq.com', 'smartrecruiters.com', 'icims.com', 'bamboohr.com', 'jobvite.com',
    'breezy.hr', 'recruitee.com', 'workable.com', 'taleo.net', 'successfactors.com',
    'oraclecloud.com', 'zohorecruit.com', 'darwinbox.in', 'keka.com', 'freshteam.com',
    'pinpointhq.com', 'forms.gle', 'docs.google.com', 'typeform.com', 'bit.ly', 'tinyurl.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.me', 'whatsapp.com',
)
MULTI_PART_TLDS = {
    'co.in', 'org.in', 'net.in', 'ac.in', 'gov.in', 'nic.in', 'edu.in', 'co.uk', 'org.uk', 'ac.uk',
    'com.au', 'co.jp', 'co.nz', 'com.sg', 'co.za', 'com.br', 'com.cn', 'com.hk',
}


def normalise_domain(value: Optional[str]) -> str:
    if not value:
        return ''
    v = value.strip().lower()
    if '://' in v:
        v = urlparse(v).netloc
    v = v.split('/')[0].split(':')[0]
    return v[4:] if v.startswith('www.') else v


def registrable(host: str) -> str:
    host = normalise_domain(host)
    parts = host.split('.')
    if len(parts) <= 2:
        return host
    if '.'.join(parts[-2:]) in MULTI_PART_TLDS:
        return '.'.join(parts[-3:])
    return '.'.join(parts[-2:])


def is_non_employer(domain: str) -> bool:
    d = normalise_domain(domain)
    return any(d == b or d.endswith('.' + b) for b in NON_EMPLOYER_DOMAINS)


def usable_domain(domain: Optional[str]) -> Optional[str]:
    d = normalise_domain(domain)
    if not d or '.' not in d or is_non_employer(d):
        return None
    return d


def same_site(host: str, domain: str) -> bool:
    return registrable(host) == registrable(domain)
