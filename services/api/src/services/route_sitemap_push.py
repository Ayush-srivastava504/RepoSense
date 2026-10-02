# Module: services/route_sitemap_push.py
# Pure logic for pushing the NON-job sitemaps (static, hackathons, tools, blog, skills, companies, locations,
# batches, resume, careers) to IndexNow. No DB / network here so tests/test_route_sitemap_push.py needs neither;
# scripts/push_route_sitemaps.py does the fetching, submitting and state updates.
#
# Rules:
#   new      URL in the sitemap that we have never pushed            -> submit
#   changed  URL whose <lastmod> differs from the one we pushed      -> submit
#   removed  URL we pushed that is no longer in a healthy sitemap    -> submit (IndexNow treats it as a removal
#            notice once the page 404s/410s/noindexes) and forget it
# Sitemaps with no <lastmod> only ever produce 'new' and 'removed' (nothing to compare), so a static page is
# pushed once, not every day.

import re
from typing import Dict, Iterable, List, Tuple

LOC_RX = re.compile(r'<url>(.*?)</url>', re.DOTALL)
_LOC = re.compile(r'<loc>\s*([^<\s]+)\s*</loc>')
_LASTMOD = re.compile(r'<lastmod>\s*([^<\s]+)\s*</lastmod>')

# If more than this share of previously-known URLs vanish from a sitemap in one run, assume the sitemap is
# broken/truncated rather than that most of the site was deleted, and send no removal notices.
MAX_REMOVED_RATIO = 0.5
INDEXNOW_BATCH = 10000       # IndexNow hard limit per request
DEFAULT_MAX_URLS = 2000      # per run, across all sitemaps; the rest go out on the next run


def parse_sitemap(xml: str) -> Dict[str, str]:
    """{url: lastmod or ''} for a <urlset> document. A <sitemapindex> yields {} (child sitemaps are not followed)."""
    out: Dict[str, str] = {}
    for block in LOC_RX.findall(xml or ''):
        m = _LOC.search(block)
        if not m:
            continue
        lm = _LASTMOD.search(block)
        out[m.group(1)] = lm.group(1) if lm else ''
    return out


def diff(known: Dict[str, str], current: Dict[str, str]) -> Tuple[List[str], List[str], List[str]]:
    """known/current: {url: lastmod}. -> (new, changed, removed), each sorted."""
    new = sorted(u for u in current if u not in known)
    changed = sorted(u for u, lm in current.items() if u in known and lm and lm != known[u])
    removed = sorted(u for u in known if u not in current)
    return new, changed, removed


def removal_is_safe(known_count: int, removed_count: int) -> bool:
    if known_count == 0 or removed_count == 0:
        return True
    return (removed_count / known_count) <= MAX_REMOVED_RATIO


def plan(known: Dict[str, str], current: Dict[str, str]) -> Dict[str, List[str]]:
    """What to submit for one healthy sitemap. Removals are dropped (and reported) when they look like a broken sitemap."""
    new, changed, removed = diff(known, current)
    skipped_removals: List[str] = []
    if not current:                                   # empty urlset: never treat as "everything was deleted"
        skipped_removals, removed = removed, []
    elif not removal_is_safe(len(known), len(removed)):
        skipped_removals, removed = removed, []
    return {'new': new, 'changed': changed, 'removed': removed, 'skipped_removals': skipped_removals}


def chunks(urls: List[str], size: int = INDEXNOW_BATCH) -> Iterable[List[str]]:
    for i in range(0, len(urls), size):
        yield urls[i:i + size]
