"""Wikidata as an extra, structured source for the 'overview' / 'history' / 'locations' topics.

Matching is by EXACT official-website equality only: the entity's P856 value must normalise to the
company's verified official domain. No name search, so a similarly named company can never be attached.
Zero or several matching entities -> no source. Everything stored is a plain Wikidata statement.
"""
import asyncio
import re
from typing import Optional

import httpx

from .domains import normalise_domain

API = 'https://www.wikidata.org/w/api.php'
ENTITY_URL = 'https://www.wikidata.org/wiki/'
WIKIDATA_PREFIX = ENTITY_URL
LINKED_PROPS = ('P159', 'P452', 'P112', 'P17')       # headquarters, industry, founder, country


def url_variants(domain: str) -> list:
    d = normalise_domain(domain)
    return [f'https://{d}/', f'https://{d}', f'https://www.{d}/', f'https://www.{d}', f'http://{d}/', f'http://www.{d}/']


def _claim_values(entity: dict, prop: str) -> list:
    out = []
    for c in entity.get('claims', {}).get(prop, []):
        if c.get('rank') == 'deprecated':
            continue
        dv = (c.get('mainsnak') or {}).get('datavalue')
        if dv:
            out.append((dv.get('value'), c))
    return out


def _year(time_value: dict) -> Optional[str]:
    m = re.match(r'^[+-](\d{4})', (time_value or {}).get('time', ''))
    return m.group(1) if m else None


def _ids(entity: dict, prop: str) -> list:
    return [v['id'] for v, _ in _claim_values(entity, prop) if isinstance(v, dict) and v.get('id')]


def website_matches(entity: dict, domain: str) -> bool:
    want = normalise_domain(domain)
    return any(isinstance(v, str) and normalise_domain(v) == want for v, _ in _claim_values(entity, 'P856'))


def build_text(entity: dict, labels: dict, name: str) -> str:
    """Entity JSON + id->label map -> plain sentences. Empty string if there is nothing useful."""
    label = (entity.get('labels', {}).get('en') or {}).get('value') or name
    lines = []
    desc = (entity.get('descriptions', {}).get('en') or {}).get('value')
    if desc:
        lines.append(f'{label} is described on Wikidata as: {desc}.')
    for v, _ in _claim_values(entity, 'P571')[:1]:
        y = _year(v)
        if y:
            lines.append(f'{label} was founded in {y}.')
    for prop, phrase in (('P112', 'Founders'), ('P159', 'Headquarters'), ('P17', 'Country'), ('P452', 'Industry')):
        names = [labels[i] for i in _ids(entity, prop) if i in labels][:4]
        if names:
            lines.append(f'{phrase}: {", ".join(names)}.')
    for v, c in _claim_values(entity, 'P1128')[:1]:
        amount = (v or {}).get('amount', '').lstrip('+')
        if amount and amount.replace('.', '', 1).isdigit():
            when = ''
            for q in (c.get('qualifiers') or {}).get('P585', []):
                y = _year((q.get('datavalue') or {}).get('value') or {})
                when = f' (as of {y})' if y else ''
            lines.append(f'Number of employees: {int(float(amount))}{when}.')
    return ' '.join(lines)


class WikidataSource:
    def __init__(self, client: httpx.AsyncClient, delay_s: float = 1.0):
        self._c = client
        self._delay = delay_s

    async def _get(self, **params) -> dict:
        await asyncio.sleep(self._delay)
        r = await self._c.get(API, params={'format': 'json', **params})
        r.raise_for_status()
        return r.json()

    async def find_qid(self, domain: str) -> Optional[str]:
        for url in url_variants(domain):
            data = await self._get(action='query', list='search', srsearch=f'haswbstatement:P856="{url}"', srlimit=3)
            hits = [h['title'] for h in data.get('query', {}).get('search', []) if re.fullmatch(r'Q\d+', h.get('title', ''))]
            if len(hits) == 1:
                return hits[0]
            if len(hits) > 1:
                return None                      # ambiguous -> never guess
        return None

    async def fetch(self, domain: str, name: str) -> Optional[dict]:
        """-> {'url','title','text'} or None. Never raises on network/shape problems."""
        try:
            qid = await self.find_qid(domain)
            if not qid:
                return None
            ent = (await self._get(action='wbgetentities', ids=qid, props='labels|descriptions|claims',
                                   languages='en')).get('entities', {}).get(qid)
            if not ent or not website_matches(ent, domain):
                return None
            ids = sorted({i for p in LINKED_PROPS for i in _ids(ent, p)})[:40]
            labels = {}
            if ids:
                got = (await self._get(action='wbgetentities', ids='|'.join(ids), props='labels', languages='en')).get('entities', {})
                labels = {k: v['labels']['en']['value'] for k, v in got.items() if v.get('labels', {}).get('en')}
            text = build_text(ent, labels, name)
            if len(text) < 60:
                return None
            return {'url': f'{ENTITY_URL}{qid}', 'title': f'{name} - Wikidata', 'text': text}
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            return None
