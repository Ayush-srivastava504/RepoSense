# Fact-only company profiles. Replaces the old Groq-based CompanyEnrichmentService,
# which guessed "what kind of company this is" and wrote culture / review-style
# text from a company name and a few job titles. Nothing here is guessed: every
# number and name in the output is an aggregate over the company's own currently
# listed jobs (same freshness window the /companies/[slug] page uses), and a
# statement is only made when the data for it exists.
#
# Pure functions, no DB and no network, so the output is deterministic and
# unit-testable. Database access lives in scripts/enrich_all_content.py.

from datetime import date, datetime
from typing import Iterable, Optional

FACTS_MODEL = 'facts-v1'
SITE_NAME = 'InternFlow'

# A profile gets an overview only when at least this many *substantive* kinds of
# fact exist (locations, work mode, role families, skills, eligibility, pay).
# Listing counts, dates and the official-domain note don't count: below the bar
# the page would get a one-line stub, which is the thin content we are avoiding.
MIN_SUBSTANTIVE_SECTIONS = 2
_SUBSTANTIVE = {'locations', 'work_mode', 'functions', 'skills', 'eligibility', 'pay'}

TOP_LOCATIONS = 5
TOP_FUNCTIONS = 3
TOP_SKILLS = 8
TOP_COURSES = 4
MAX_KEYWORDS = 10

_WORK_MODE_LABELS = {'ONSITE': 'on-site', 'REMOTE': 'remote', 'HYBRID': 'hybrid'}


def top_counts(pairs: Iterable[tuple], limit: int) -> list[dict]:
    """(value, count) pairs -> top `limit` [{'name', 'count'}], merging values that
    differ only by case/whitespace (the most frequent spelling is displayed)."""
    merged: dict[str, dict] = {}
    for value, n in pairs:
        name = ' '.join(str(value or '').split())
        if not name or not n:
            continue
        entry = merged.setdefault(name.lower(), {'variants': {}, 'count': 0})
        entry['count'] += int(n)
        entry['variants'][name] = entry['variants'].get(name, 0) + int(n)
    ranked = sorted(merged.items(), key=lambda kv: (-kv[1]['count'], kv[0]))
    out = []
    for _, entry in ranked[:limit]:
        display = max(entry['variants'].items(), key=lambda kv: (kv[1], kv[0] != kv[0].lower(), kv[0]))[0]
        out.append({'name': display, 'count': entry['count']})
    return out


def _iso(value) -> Optional[str]:
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return None


def build_facts(base: dict, *, locations=(), work_modes=(), functions=(), skills=(),
                courses=(), as_of: Optional[date] = None) -> dict:
    """Assemble the fact sheet. `base` is one row of the aggregate query; the other
    arguments are (value, count) pairs. Absent data stays absent (None / empty)."""
    active = int(base.get('active_listings') or 0)
    internships = int(base.get('internships') or 0)
    modes = {}
    for value, n in work_modes:
        key = str(value or '').strip().upper()
        if key in _WORK_MODE_LABELS and n:
            modes[key] = modes.get(key, 0) + int(n)
    exp_min, exp_max = base.get('experience_min'), base.get('experience_max')
    return {
        'as_of': (as_of or date.today()).isoformat(),
        'active_listings': active,
        'internships': internships,
        'jobs': active - internships,
        'locations': top_counts(locations, TOP_LOCATIONS),
        'work_modes': modes,
        'remote_listings': int(base.get('remote_listings') or 0),
        'job_functions': top_counts(functions, TOP_FUNCTIONS),
        'skills': top_counts(skills, TOP_SKILLS),
        'courses': top_counts(courses, TOP_COURSES),
        'experience': {
            'min': exp_min, 'max': exp_max,
            'fresher_listings': int(base.get('fresher_listings') or 0),
        } if exp_min is not None or exp_max is not None else None,
        'pay': {
            'stipend_listings': int(base.get('stipend_listings') or 0),
            'salary_listings': int(base.get('salary_listings') or 0),
        },
        'official_domain': base.get('official_domain') or None,
        'first_listed': _iso(base.get('first_listed')),
        'latest_posted': _iso(base.get('latest_posted')),
    }


def _plural(n: int, singular: str, plural: Optional[str] = None) -> str:
    return f'{n} {singular if n == 1 else (plural or singular + "s")}'


def _fmt_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f'{d.day} {d.strftime("%b %Y")}'


def _ranked(items: list[dict]) -> str:
    return ', '.join(f"{i['name']} ({i['count']})" for i in items)


def _sections(facts: dict) -> list[str]:
    """Which kinds of fact are present, in the order they are written."""
    present = []
    if facts['active_listings']:
        present.append('listings')
    if facts['locations']:
        present.append('locations')
    if facts['work_modes'] or facts['remote_listings']:
        present.append('work_mode')
    if facts['job_functions']:
        present.append('functions')
    if facts['skills']:
        present.append('skills')
    if facts['courses'] or facts['experience']:
        present.append('eligibility')
    pay = facts['pay']
    if pay['stipend_listings'] or pay['salary_listings']:
        present.append('pay')
    if facts['official_domain']:
        present.append('domain')
    if facts['first_listed'] or facts['latest_posted']:
        present.append('dates')
    return present


def render_overview(company: str, facts: dict) -> Optional[str]:
    """Prose summary of the fact sheet, or None when there are too few facts."""
    present = _sections(facts)
    if 'listings' not in present or len(_SUBSTANTIVE.intersection(present)) < MIN_SUBSTANTIVE_SECTIONS:
        return None
    parts = []
    n, k, j = facts['active_listings'], facts['internships'], facts['jobs']
    as_of = _fmt_date(facts['as_of'])
    if k and j:
        mix = f'{_plural(k, "internship")} and {_plural(j, "job")}'
        parts.append(f'As of {as_of}, {company} has {_plural(n, "active listing")} on {SITE_NAME}: {mix}.')
    elif k:
        parts.append(f'As of {as_of}, {company} has {_plural(k, "active internship listing")} on {SITE_NAME}.')
    else:
        parts.append(f'As of {as_of}, {company} has {_plural(j, "active job listing")} on {SITE_NAME}.')
    if facts['locations']:
        parts.append(f'Locations listed: {_ranked(facts["locations"])}.')
    if facts['work_modes']:
        modes = ', '.join(f'{c} {_WORK_MODE_LABELS[m]}' for m, c in sorted(facts['work_modes'].items(), key=lambda kv: (-kv[1], kv[0])))
        parts.append(f'Work mode where stated: {modes}.')
    elif facts['remote_listings']:
        parts.append(f'{_plural(facts["remote_listings"], "listing")} {"is" if facts["remote_listings"] == 1 else "are"} marked remote.')
    if facts['job_functions']:
        parts.append(f'Most common role families: {_ranked(facts["job_functions"])}.')
    if facts['skills']:
        parts.append(f'Skills named most often across these listings: {_ranked(facts["skills"])}.')
    if facts['courses']:
        parts.append(f'Courses listed as eligible: {_ranked(facts["courses"])}.')
    exp = facts['experience']
    if exp:
        lo, hi = exp['min'], exp['max']
        if lo is not None and hi is not None and lo != hi:
            span = f'Experience required ranges from {lo} to {hi} years'
        elif lo is not None or hi is not None:
            span = f'Experience required is {lo if lo is not None else hi} years'
        else:
            span = ''
        if span and exp['fresher_listings']:
            span += f'; {_plural(exp["fresher_listings"], "listing")} {"is" if exp["fresher_listings"] == 1 else "are"} open to freshers (0 years)'
        if span:
            parts.append(span + '.')
    pay = facts['pay']
    pay_bits = []
    if pay['stipend_listings']:
        pay_bits.append(f'{_plural(pay["stipend_listings"], "listing")} state{"s" if pay["stipend_listings"] == 1 else ""} a stipend')
    if pay['salary_listings']:
        pay_bits.append(f'{_plural(pay["salary_listings"], "listing")} state{"s" if pay["salary_listings"] == 1 else ""} a salary')
    if pay_bits:
        parts.append(' and '.join(pay_bits).capitalize() + '.')
    if facts['official_domain']:
        parts.append(f'Some application links go to the company\'s own domain, {facts["official_domain"]}.')
    latest, first = facts['latest_posted'], facts['first_listed']
    if latest and first and latest != first:
        parts.append(f'The most recent listing was posted on {_fmt_date(latest)}; the earliest current listing dates from {_fmt_date(first)}.')
    elif latest or first:
        parts.append(f'Listings were posted on {_fmt_date(latest or first)}.')
    return ' '.join(parts)


def build_keywords(company: str, facts: dict) -> list[str]:
    """Search keywords drawn only from the fact sheet."""
    words = [company.strip().lower()]
    words += [f['name'].lower() for f in facts['job_functions']]
    words += [s['name'].lower() for s in facts['skills'][:5]]
    words += [l['name'].lower() for l in facts['locations'][:2]]
    if facts['internships']:
        words.append('internship')
    seen, out = set(), []
    for w in words:
        if w and w not in seen:
            seen.add(w)
            out.append(w)
    return out[:MAX_KEYWORDS]
