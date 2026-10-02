"""The fixed topic set written for every company, and how pages are mapped to topics."""
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse


@dataclass(frozen=True)
class Topic:
    key: str
    title: str                       # section heading; {name} is replaced
    keywords: tuple                  # matched against link path + anchor text
    probe_paths: tuple               # tried directly when no link was found
    guidance: str                    # what the writer should cover (only if the pages say it)
    also_from: tuple = ()            # extra topic_hints whose pages may feed this topic


# Order matters for classify_link: more specific topics first.
TOPICS: tuple = (
    Topic('hiring_process', 'Hiring process at {name}', ('hiring-process', 'how-we-hire', 'interview', 'selection-process', 'recruitment-process'),
          ('/careers/hiring-process', '/careers/how-we-hire'), 'The stages candidates go through, as described on the pages.'),
    Topic('early_careers', 'Internships and graduate programs at {name}', ('early-career', 'student', 'campus', 'graduate', 'intern', 'fresher', 'university'),
          ('/careers/students', '/careers/early-careers', '/students', '/campus', '/internships'), 'Programs for students and freshers, eligibility and duration if stated.'),
    Topic('careers', 'Careers at {name}', ('career', 'jobs', 'join-us', 'work-with-us', 'openings'),
          ('/careers', '/jobs', '/join-us'), 'What the company says about working there and the kinds of teams it hires for.'),
    Topic('tech', 'Technology and engineering at {name}', ('engineering', 'technology', 'developers', 'innovation', 'research'),
          ('/engineering', '/technology', '/developers'), 'Technologies, engineering practices or research areas named on the pages.'),
    Topic('products', 'Products and services of {name}', ('product', 'solution', 'service', 'platform', 'offering'),
          ('/products', '/solutions', '/services', '/platform'), 'What the company sells or builds, as named on the pages.'),
    Topic('culture', 'Culture and values at {name}', ('culture', 'values', 'life-at', 'our-people', 'diversity', 'benefits'),
          ('/culture', '/values', '/life-at-work'), 'Stated values, benefits and working practices.'),
    Topic('locations', 'Offices and locations of {name}', ('contact', 'office', 'location', 'where-we'),
          ('/contact', '/offices', '/locations'), 'Cities, countries and offices that are named.', also_from=('overview',)),
    Topic('history', 'History of {name}', ('history', 'our-story', 'milestone', 'timeline'),
          ('/history', '/our-story'), 'Founding year, founders and milestones that are stated.', also_from=('overview',)),
    Topic('faq', 'Frequently asked questions about {name}', ('faq', 'frequently-asked'),
          ('/faq', '/careers/faq'), 'Questions and answers published by the company.'),
    Topic('overview', 'What {name} does', ('about', 'who-we-are', 'company', 'about-us'),
          ('/about', '/about-us', '/company'), 'A plain description of the business, who it serves and its size if stated.'),
)
TOPIC_BY_KEY = {t.key: t for t in TOPICS}
MIN_PUBLISHED_TOPICS = 5   # a company page is indexable on topics alone from this many published sections

_SKIP_EXT = ('.pdf', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.zip', '.doc', '.docx', '.xls', '.xlsx', '.mp4')
MAX_PATH_DEPTH = 3


def classify_link(url: str, anchor: str = '') -> Optional[str]:
    """Topic key a link probably belongs to, or None. Looks only at the path and anchor text."""
    p = urlparse(url)
    path = p.path.lower()
    if p.scheme not in ('http', 'https') or path.endswith(_SKIP_EXT):
        return None
    segments = [s for s in path.split('/') if s]
    if len(segments) > MAX_PATH_DEPTH or any(s in ('blog', 'news', 'press', 'login', 'signin', 'register') for s in segments):
        return None
    haystack = f"{path} {anchor.lower()}".replace('_', '-')
    host = p.netloc.lower().split(':')[0]
    if host.startswith('careers.') or host.startswith('jobs.'):
        haystack += ' career'
    for topic in TOPICS:
        if any(k in haystack for k in topic.keywords):
            return topic.key
    return None
