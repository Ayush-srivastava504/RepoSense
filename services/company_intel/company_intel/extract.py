"""HTML -> clean text, outgoing links and a few structured facts. Pure functions."""
import hashlib
import json
import re
from dataclasses import dataclass, field
from urllib.parse import urldefrag, urljoin

from bs4 import BeautifulSoup

MAX_PAGE_CHARS = 8000
MIN_USEFUL_CHARS = 200
_DROP = ('script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'aside', 'form', 'iframe')


@dataclass
class Page:
    title: str = ''
    description: str = ''
    text: str = ''
    links: list = field(default_factory=list)    # [(absolute_url, anchor_text)]
    facts: str = ''                              # facts from JSON-LD Organization, "" if none


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:32]


def _collapse(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def _jsonld_facts(soup: BeautifulSoup) -> str:
    out = []
    for tag in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(tag.string or '')
        except (ValueError, TypeError):
            continue
        for node in (data if isinstance(data, list) else data.get('@graph', [data]) if isinstance(data, dict) else []):
            if not isinstance(node, dict) or 'Organization' not in str(node.get('@type', '')):
                continue
            addr = node.get('address') if isinstance(node.get('address'), dict) else {}
            emp = node.get('numberOfEmployees')
            parts = {
                'legal name': node.get('legalName'), 'founded': node.get('foundingDate'),
                'employees': emp.get('value') if isinstance(emp, dict) else emp,
                'locality': addr.get('addressLocality'), 'country': addr.get('addressCountry'),
            }
            out.append(', '.join(f'{k}: {v}' for k, v in parts.items() if v and isinstance(v, (str, int))))
    return '; '.join(o for o in out if o)


def extract_page(html: str, base_url: str) -> Page:
    soup = BeautifulSoup(html, 'lxml')
    page = Page()
    page.title = _collapse(soup.title.get_text()) if soup.title else ''
    meta = soup.find('meta', attrs={'name': 'description'})
    page.description = _collapse(meta.get('content', '')) if meta else ''
    page.facts = _jsonld_facts(soup)
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
            continue
        page.links.append((urldefrag(urljoin(base_url, href))[0], _collapse(a.get_text())[:80]))
    full_body = _collapse((soup.body or soup).get_text(' ', strip=True))
    for tag in soup(_DROP):
        tag.decompose()
    main = soup.find('main') or soup.find('article') or soup.body or soup
    cleaned = _collapse(main.get_text(' ', strip=True))
    # Some sites put their real content inside <header>/<nav>-like wrappers; fall back to the whole body.
    text = cleaned if len(cleaned) >= 300 else full_body
    page.text = text[:MAX_PAGE_CHARS]
    return page
