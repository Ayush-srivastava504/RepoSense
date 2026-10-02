# Module: services/chart_aggregator.py
# Nightly aggregation behind the shared charts. Reads active listings, groups them by
# jobs.segment_key (written by crawler/src/processors/content_layer.py) and by editorial
# TOPICS, and stores real percentages in chart_stats (migration 031). Nothing is estimated:
# every figure is a share of actual listings, with its sample size stored next to it.
#
# Pure functions (aggregate, finalize) hold all the logic so tests need no database;
# rebuild() is the thin DB wrapper that scripts/build_chart_stats.py calls.

import json
import re
from collections import Counter
from typing import Dict, Iterable, Optional

MIN_SAMPLE = 25          # fewer listings than this -> no chart is stored for that key
MAX_SEGMENTS = 500       # keep only the biggest segments
TOP_LOCATIONS = 8

# Which listings count: real, live ones. 'uncertain' rows are excluded on purpose (thin or unverified).
BASIS = "active listings with legitimacy verified/likely (or not yet scored)"

JOB_SQL = '''
SELECT id, title, type, location, is_remote, segment_key, work_mode, experience_min,
       required_skills, enriched_keywords, left(coalesce(description, ''), 6000) AS description
  FROM jobs
 WHERE is_active = TRUE
   AND (legitimacy_state IS NULL OR legitimacy_state IN ('verified', 'likely'))
'''

# label (as used in blog chart xAxis) -> regex tested on title + description + skills + keywords
SKILLS: Dict[str, str] = {
    'Python': r'\bpython\b',
    'SQL': r'\bsql\b',
    'Machine Learning': r'machine[- ]learning|\bml\b',
    'Deep Learning': r'deep[- ]learning',
    'PyTorch': r'\bpy ?torch\b',
    'TensorFlow': r'\btensor ?flow\b',
    'LLM': r'\bllms?\b|large language model',
    'MLOps': r'\bmlops\b',
    'Cloud': r'\b(aws|azure|gcp|google cloud|cloud)\b',
    'AWS': r'\baws\b|amazon web services',
    'GCP': r'\bgcp\b|google cloud',
    'Azure': r'\bazure\b',
    'Docker': r'\bdocker\b',
    'Kubernetes': r'\b(kubernetes|k8s)\b',
    'Java': r'\bjava\b',
    'JavaScript': r'\bjavascript\b|\bnode\.?js\b',
    'React': r'\breact(\.js)?\b',
    'Git': r'\bgit\b',
}
_SKILL_RX = {k: re.compile(v, re.IGNORECASE) for k, v in SKILLS.items()}

# Experience buckets use experience_min (years). Labels match the blog chart xAxis exactly.
EXPERIENCE_BUCKETS = ('0 Years', '1-2 Years', '3-5 Years', '6+ Years')

# topic slug -> title regex. A listing joins every topic whose regex matches its title.
TOPICS: Dict[str, re.Pattern] = {
    'machine-learning-engineer': re.compile(r'machine[- ]learning|\bml\b|\bmlops\b', re.IGNORECASE),
}


def _is_remote(location: str) -> bool:
    return bool(re.search(r'\bremote\b', location or '', re.IGNORECASE))


def segment_key_for(job: dict) -> str:
    """Stored segment_key, or the same derivation as content_layer.segment_key for rows
    crawled before migration 026 (tests pin the two together)."""
    if job.get('segment_key'):
        return job['segment_key']
    title = job.get('title') or ''
    location = job.get('location') or ''
    role = title.split()[0].lower() if title else 'general'
    loc = 'remote' if _is_remote(location) else (location.split(',')[0].lower() or 'india')
    return f"{job.get('type') or ''}:{role}:{loc}"


def experience_bucket(years: Optional[int]) -> Optional[str]:
    if years is None:
        return None
    if years <= 0:
        return EXPERIENCE_BUCKETS[0]
    if years <= 2:
        return EXPERIENCE_BUCKETS[1]
    if years <= 5:
        return EXPERIENCE_BUCKETS[2]
    return EXPERIENCE_BUCKETS[3]


def work_mode_of(job: dict) -> Optional[str]:
    wm = (job.get('work_mode') or '').strip().lower()
    if 'hybrid' in wm:
        return 'Hybrid'
    if 'remote' in wm or job.get('is_remote') or _is_remote(job.get('location') or ''):
        return 'Remote'
    if wm in ('onsite', 'on-site', 'on site', 'office'):
        return 'On-Site'
    return None


class _Acc:
    __slots__ = ('n', 'skills', 'exp', 'exp_known', 'mode', 'mode_known', 'loc')

    def __init__(self):
        self.n = 0
        self.skills, self.exp, self.mode, self.loc = Counter(), Counter(), Counter(), Counter()
        self.exp_known = self.mode_known = 0

    def add(self, hits, exp_b, mode, loc):
        self.n += 1
        self.skills.update(hits)
        if exp_b:
            self.exp[exp_b] += 1
            self.exp_known += 1
        if mode:
            self.mode[mode] += 1
            self.mode_known += 1
        if loc:
            self.loc[loc] += 1


def _pct(count: int, total: int) -> float:
    return round(100.0 * count / total, 1) if total else 0.0


def aggregate(jobs: Iterable[dict]) -> Dict[str, _Acc]:
    accs: Dict[str, _Acc] = {}
    for job in jobs:
        text = ' '.join([job.get('title') or '', job.get('description') or '',
                         ' '.join(job.get('required_skills') or []), ' '.join(job.get('enriched_keywords') or [])])
        hits = [name for name, rx in _SKILL_RX.items() if rx.search(text)]
        exp_b = experience_bucket(job.get('experience_min'))
        mode = work_mode_of(job)
        loc = 'Remote' if _is_remote(job.get('location') or '') else ((job.get('location') or '').split(',')[0].strip() or None)
        keys = ['segment:' + segment_key_for(job)]
        keys += ['topic:' + slug for slug, rx in TOPICS.items() if rx.search(job.get('title') or '')]
        for key in keys:
            accs.setdefault(key, _Acc()).add(hits, exp_b, mode, loc)
    return accs


def finalize(accs: Dict[str, _Acc], min_sample: int = MIN_SAMPLE) -> Dict[str, dict]:
    """-> {chart_key: {kind, sample_size, stats}} for keys with enough listings."""
    out = {}
    big = [(k, a) for k, a in accs.items() if a.n >= min_sample]
    segs = sorted((x for x in big if x[0].startswith('segment:')), key=lambda x: -x[1].n)[:MAX_SEGMENTS]
    topics = [x for x in big if x[0].startswith('topic:')]
    for key, a in segs + topics:
        out[key] = {
            'kind': key.split(':', 1)[0],
            'sample_size': a.n,
            'stats': {
                'basis': BASIS,
                'skills_pct': {s: _pct(c, a.n) for s, c in sorted(a.skills.items(), key=lambda x: -x[1])},
                'experience_pct': {b: _pct(a.exp[b], a.exp_known) for b in EXPERIENCE_BUCKETS},
                'experience_known': a.exp_known,
                'work_mode_pct': {m: _pct(c, a.mode_known) for m, c in a.mode.most_common()},
                'work_mode_known': a.mode_known,
                'top_locations': [{'name': n, 'pct': _pct(c, a.n)} for n, c in a.loc.most_common(TOP_LOCATIONS)],
            },
        }
    return out


async def rebuild(pool) -> dict:
    """Recompute every chart and replace chart_stats atomically. Refuses to wipe the table
    when the jobs query returns nothing (DB problem, not 'no data')."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            accs: Dict[str, _Acc] = {}
            batch = []
            async for row in conn.cursor(JOB_SQL, prefetch=2000):
                batch.append(dict(row))
                if len(batch) >= 2000:
                    _merge(accs, aggregate(batch))
                    batch = []
            if batch:
                _merge(accs, aggregate(batch))
    if not accs:
        raise RuntimeError('no active listings returned; leaving chart_stats untouched')
    charts = finalize(accs)
    async with pool.acquire() as conn:
        async with conn.transaction():
            for key, c in charts.items():
                await conn.execute(
                    '''INSERT INTO chart_stats (chart_key, kind, sample_size, stats, computed_at)
                       VALUES ($1, $2, $3, $4::jsonb, now())
                       ON CONFLICT (chart_key) DO UPDATE
                       SET kind = EXCLUDED.kind, sample_size = EXCLUDED.sample_size,
                           stats = EXCLUDED.stats, computed_at = now()''',
                    key, c['kind'], c['sample_size'], json.dumps(c['stats']))
            removed = await conn.fetchval(
                'WITH d AS (DELETE FROM chart_stats WHERE NOT (chart_key = ANY($1::text[])) RETURNING 1) SELECT count(*) FROM d',
                list(charts))
    return {'charts': len(charts), 'segments': sum(1 for k in charts if k.startswith('segment:')),
            'topics': sum(1 for k in charts if k.startswith('topic:')), 'removed_stale': removed}


def _merge(into: Dict[str, _Acc], part: Dict[str, _Acc]) -> None:
    for key, a in part.items():
        t = into.setdefault(key, _Acc())
        t.n += a.n
        t.skills.update(a.skills)
        t.exp.update(a.exp)
        t.mode.update(a.mode)
        t.loc.update(a.loc)
        t.exp_known += a.exp_known
        t.mode_known += a.mode_known
