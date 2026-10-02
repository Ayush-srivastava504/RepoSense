"""seed -> crawl -> enrich. Each stage is idempotent and safe to re-run."""
import hashlib
import re
from collections import defaultdict
from typing import Optional

from . import db
from .domains import is_non_employer, normalise_domain, registrable, same_site, usable_domain
from .extract import MIN_USEFUL_CHARS, content_hash, extract_page
from .grounding import (MIN_SOURCE_CHARS, PROMPT_VERSION, SYSTEM_PROMPT, build_topic_input, parse_model_json,
                        user_prompt, validate_output)
from .wikidata import WIKIDATA_PREFIX
from .topics import TOPIC_BY_KEY, TOPICS, classify_link

MAX_FETCHES_PER_COMPANY = 14
MAX_URLS_PER_TOPIC = 2
RECRAWL_AFTER_DAYS = 30


MIN_JOBS_UNVERIFIED = 3        # unverified domain must appear on at least this many of the company's jobs
MIN_JOBS_NO_NAME_MATCH = 10    # ...or this many if the domain does not resemble the company name
MAX_COMPANIES_PER_DOMAIN = 3   # a domain shared by more companies is an agency/portal, not an employer site


def _name_matches_domain(name: Optional[str], domain: str) -> bool:
    if not name:
        return False
    label = registrable(domain).split('.')[0]
    key = re.sub(r'[^a-z0-9]+', '', name.lower())
    first = re.sub(r'[^a-z0-9]+', '', (name.lower().split() or [''])[0])
    if len(label) < 3:
        return False
    return label in key or (len(key) >= 3 and key in label) or (len(first) >= 3 and label.startswith(first))


def choose_domain(rows: list, name: Optional[str] = None, domain_companies: Optional[dict] = None) -> Optional[str]:
    """rows: [{'apply_domain','official','n'}] for ONE company -> best employer domain or None.
    1) A domain the trust scorer marked official wins (most jobs first).
    2) Otherwise fall back to the company's most common non-job-board domain, if it appears on
       >= MIN_JOBS_UNVERIFIED jobs, is not shared by many companies (domain_companies: domain -> count of
       distinct companies using it), and either looks like the company name or appears on >= MIN_JOBS_NO_NAME_MATCH jobs."""
    best, best_n = None, -1
    for r in rows:
        d = usable_domain(r['apply_domain'])
        if d and r['official'] and r['n'] > best_n:
            best, best_n = d, r['n']
    if best:
        return best
    for r in sorted(rows, key=lambda x: -x['n']):
        d = usable_domain(r['apply_domain'])
        if not d or r['n'] < MIN_JOBS_UNVERIFIED:
            continue
        if domain_companies is not None and domain_companies.get(d, 1) > MAX_COMPANIES_PER_DOMAIN:
            continue
        if _name_matches_domain(name, d) or r['n'] >= MIN_JOBS_NO_NAME_MATCH:
            return d
    return None


async def seed(pool, limit: int = 5000) -> dict:
    rows = await pool.fetch(db.SEED_ROWS_SQL)
    by_company = defaultdict(list)
    for r in rows:
        by_company[r['company']].append(dict(r))
    domain_companies: dict = defaultdict(set)
    for name, items in by_company.items():
        for x in items:
            d = usable_domain(x['apply_domain'])
            if d:
                domain_companies[d].add(name)
    domain_companies = {d: len(c) for d, c in domain_companies.items()}
    ranked = sorted(by_company.items(), key=lambda kv: -sum(x['n'] for x in kv[1]))[:limit]
    taken: set = {r['slug'] for r in await pool.fetch('SELECT slug FROM company_entities')}
    counts = {'with_domain': 0, 'skipped': 0}
    for name, items in ranked:
        key = db.name_key(name)
        if not key:
            continue
        existing = await pool.fetchrow('SELECT slug FROM company_entities WHERE name_key = $1', key)
        slug = existing['slug'] if existing else db.company_slug(name)
        if not existing:
            base, i = slug, 2
            while not slug or slug in taken:
                slug, i = f'{base}-{i}', i + 1
            taken.add(slug)
        domain = choose_domain(items, name, domain_companies)
        status, reason = ('pending', None) if domain else ('skipped', 'no usable employer domain')
        await pool.fetchval(db.UPSERT_ENTITY_SQL, slug, name, key, domain, status, reason)
        counts['with_domain' if domain else 'skipped'] += 1
    return counts


async def _store_wikidata(pool, wikidata, entity, site: str) -> int:
    if wikidata is None:
        return 0
    doc = await wikidata.fetch(site, entity['name'])
    if not doc:
        return 0
    await pool.execute(db.UPSERT_SOURCE_SQL, entity['id'], doc['url'], 'overview', doc['title'], doc['text'],
                       content_hash(doc['text']), None)
    return 1


async def crawl_entity(pool, fetcher, entity, wikidata=None) -> dict:
    site = normalise_domain(entity['official_domain'])
    stored, fetches = 0, 0
    home = None
    stored += await _store_wikidata(pool, wikidata, entity, site)
    for start in (f'https://{site}/', f'https://www.{site}/'):
        fetches += 1
        res = await fetcher.fetch(start, site)
        if res.ok:
            home = (res, extract_page(res.html, res.final_url or start))
            break
    if home is None:
        status = 'active' if stored else 'skipped'
        await pool.execute(db.MARK_CRAWLED_SQL, entity['id'], status,
                           None if stored else 'homepage not reachable or disallowed by robots.txt')
        return {'stored': stored, 'fetches': fetches, 'status': status}
    res, page = home
    seen = {res.final_url or res.url}
    if len(page.text) >= MIN_USEFUL_CHARS:
        await pool.execute(db.UPSERT_SOURCE_SQL, entity['id'], res.final_url or res.url, 'overview', page.title,
                           (page.facts + '\n' if page.facts else '') + page.text, content_hash(page.text))
        stored += 1
    candidates = defaultdict(list)
    for url, anchor in page.links:
        host = url.split('/')[2] if '://' in url else ''
        if not host or not same_site(host, site) or is_non_employer(host) or url in seen:
            continue
        topic = classify_link(url, anchor)
        if topic and url not in candidates[topic] and len(candidates[topic]) < MAX_URLS_PER_TOPIC:
            candidates[topic].append(url)
    for topic in TOPICS:                                  # probe common paths only where no link was found
        if not candidates[topic.key]:
            candidates[topic.key] = [f'https://{site}{p}' for p in topic.probe_paths[:1]]
    for topic in TOPICS:
        for url in candidates[topic.key]:
            if fetches >= MAX_FETCHES_PER_COMPANY or url in seen:
                continue
            seen.add(url)
            fetches += 1
            r = await fetcher.fetch(url, site)
            if not r.ok:
                continue
            p = extract_page(r.html, r.final_url or url)
            if len(p.text) < MIN_USEFUL_CHARS:
                continue
            seen.add(r.final_url)
            await pool.execute(db.UPSERT_SOURCE_SQL, entity['id'], r.final_url or url, topic.key, p.title,
                               (p.facts + '\n' if p.facts else '') + p.text, content_hash(p.text))
            stored += 1
    await pool.execute(db.MARK_CRAWLED_SQL, entity['id'], 'active' if stored else 'skipped',
                       None if stored else 'no usable pages found', )
    return {'stored': stored, 'fetches': fetches, 'status': 'active' if stored else 'skipped'}


def sources_for_topic(topic, sources: list) -> list:
    wanted = {topic.key, *topic.also_from}
    picked = [s for s in sources if s['topic_hint'] in wanted]
    # Wikidata facts are short; list them first so long pages cannot push them out of the prompt budget.
    return sorted(picked, key=lambda s: not s.get('url', '').startswith(WIKIDATA_PREFIX))


def inputs_hash(included: list) -> str:
    h = hashlib.sha256(PROMPT_VERSION.encode())
    for s in sorted(included, key=lambda s: s['url']):
        h.update(s['content_hash'].encode())
    return h.hexdigest()[:32]


async def enrich_entity(pool, writer, entity, dry_run: bool = False) -> dict:
    sources = [dict(r) for r in await pool.fetch(db.SOURCES_SQL, entity['id'])]
    previous = {r['topic_key']: r for r in await pool.fetch(db.TOPIC_HASHES_SQL, entity['id'])}
    out = {'published': 0, 'rejected': 0, 'skipped': 0, 'unchanged': 0}
    for topic in TOPICS:
        excerpts, included = build_topic_input(sources_for_topic(topic, sources))
        if sum(len(s['text']) for s in included) < MIN_SOURCE_CHARS:
            out['skipped'] += 1
            if topic.key in previous and not dry_run:
                await pool.execute('UPDATE company_topics SET status = \'stale\' WHERE entity_id = $1 AND topic_key = $2',
                                   entity['id'], topic.key)
            continue
        h = inputs_hash(included)
        if topic.key in previous and previous[topic.key]['source_hash'] == h and previous[topic.key]['status'] != 'stale':
            out['unchanged'] += 1
            continue
        title = topic.title.format(name=entity['name'])
        done = await writer.complete(SYSTEM_PROMPT, user_prompt(entity['name'], title, topic.guidance, excerpts))
        if done is None:
            out['skipped'] += 1                              # all providers down: leave for the next run
            continue
        raw, model = done
        clean, reason = validate_output(parse_model_json(raw), included, entity['name'])
        status = 'published' if clean else 'rejected'
        out[status] += 1
        if dry_run:
            continue
        await pool.execute(db.UPSERT_TOPIC_SQL, entity['id'], topic.key, title, clean['body'] if clean else None,
                           db.bullets_json(clean['bullets'] if clean else []), clean['source_urls'] if clean else [],
                           h, model, status, reason)
    return out
