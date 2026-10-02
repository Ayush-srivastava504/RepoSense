import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx

from company_intel import db, domains, grounding
from company_intel.extract import extract_page
from company_intel.fetcher import PoliteFetcher
from company_intel.pipeline import choose_domain, sources_for_topic
from company_intel.topics import TOPIC_BY_KEY, TOPICS, classify_link


def test_domains_block_job_boards_and_ats():
    for d in ('linkedin.com', 'in.linkedin.com', 'boards.greenhouse.io', 'acme.myworkdayjobs.com', 'forms.gle'):
        assert domains.usable_domain(d) is None, d
    assert domains.usable_domain('https://www.Razorpay.com/careers') == 'razorpay.com'
    assert domains.usable_domain('localhost') is None


def test_same_site_handles_multi_part_tlds():
    assert domains.same_site('careers.tcs.co.in', 'tcs.co.in')
    assert not domains.same_site('evil.co.in', 'tcs.co.in')
    assert domains.same_site('www.google.com', 'google.com')


def test_choose_domain_needs_official_and_non_aggregator():
    rows = [{'apply_domain': 'linkedin.com', 'official': True, 'n': 90},
            {'apply_domain': 'acme.com', 'official': False, 'n': 50},
            {'apply_domain': 'acme.io', 'official': True, 'n': 3}]
    assert choose_domain(rows) == 'acme.io'
    assert choose_domain(rows[:2]) is None


def test_slug_matches_web_and_name_key():
    assert db.company_slug('Tata Consultancy Services') == 'tata-consultancy-services'
    assert db.company_slug('A&B Corp.') == 'a-b-corp'
    assert db.name_key('A & B') == db.name_key('a b') == 'ab'


def test_classify_link():
    assert classify_link('https://acme.com/about-us', 'About') == 'overview'
    assert classify_link('https://acme.com/careers/students', '') == 'early_careers'
    assert classify_link('https://acme.com/careers/hiring-process', '') == 'hiring_process'
    assert classify_link('https://careers.acme.com/', '') == 'careers'
    assert classify_link('https://acme.com/blog/about-our-culture', '') is None
    assert classify_link('https://acme.com/a/b/c/d/about', '') is None
    assert classify_link('https://acme.com/brochure.pdf', 'about') is None
    assert classify_link('mailto:x@acme.com', '') is None


def test_topic_set_is_eight_to_ten():
    assert 8 <= len(TOPICS) <= 10
    assert len({t.key for t in TOPICS}) == len(TOPICS)


def test_extract_page_text_links_and_jsonld():
    html = ('<html><head><title>Acme</title><meta name="description" content="d">'
            '<script type="application/ld+json">{"@type":"Organization","legalName":"Acme Pvt Ltd","foundingDate":"2009"}</script>'
            '</head><body><nav>Menu Home</nav><main>' + 'We build payment software for banks. ' * 20 +
            '<a href="/careers">Careers</a><a href="mailto:a@b.c">m</a></main><footer>Footer junk</footer></body></html>')
    p = extract_page(html, 'https://acme.com/')
    assert 'payment software' in p.text and 'Footer junk' not in p.text and 'Menu Home' not in p.text
    assert ('https://acme.com/careers', 'Careers') in p.links and len(p.links) == 1
    assert 'founded: 2009' in p.facts


SRC = [{'url': 'https://acme.com/about', 'title': 'About', 'content_hash': 'h1',
        'text': 'Acme builds payment software for banks in India. Founded in 2009 in Pune, Acme has 1,200 employees. ' * 6}]
GOOD = {'body': ('Acme builds payment software for banks in India. The company was founded in 2009 in Pune and has about '
                 '1200 employees working on products used by banks across the country, as described on its about page.'),
        'bullets': ['Founded in 2009'], 'source_ids': [1]}


def test_validate_accepts_grounded_output():
    clean, reason = grounding.validate_output(dict(GOOD), SRC, 'Acme')
    assert reason is None and clean['source_urls'] == ['https://acme.com/about']


def test_validate_rejects_invented_numbers_names_fluff_and_bad_ids():
    bad_num = dict(GOOD, body=GOOD['body'].replace('1200', '5000'))
    assert grounding.validate_output(bad_num, SRC, 'Acme')[1].startswith('ungrounded_numbers')
    bad_name = dict(GOOD, body=GOOD['body'] + ' Its CEO Rahul Mehta and Zorgon Holdings lead it.')
    assert grounding.validate_output(bad_name, SRC, 'Acme')[1].startswith('ungrounded_names')
    assert grounding.validate_output(dict(GOOD, body=GOOD['body'] + ' A world-class team.'), SRC, 'Acme')[1] == 'marketing_language'
    assert grounding.validate_output(dict(GOOD, source_ids=[7]), SRC, 'Acme')[1] == 'no_valid_source_ids'
    assert grounding.validate_output({'body': None}, SRC, 'Acme')[1] == 'insufficient'
    assert grounding.validate_output(dict(GOOD, body='too short'), SRC, 'Acme')[1].startswith('body_length')


def test_parse_model_json_tolerates_fences():
    assert grounding.parse_model_json('```json\n{"body": null}\n```') == {'body': None}
    assert grounding.parse_model_json('nope') is None


def test_sources_for_topic_uses_also_from():
    srcs = [{'topic_hint': 'overview'}, {'topic_hint': 'products'}]
    assert sources_for_topic(TOPIC_BY_KEY['history'], srcs) == [srcs[0]]
    assert sources_for_topic(TOPIC_BY_KEY['products'], srcs) == [srcs[1]]


def _fetch(handler, url, site='acme.com'):
    async def go():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
        f = PoliteFetcher(client=client, delay_s=0)
        try:
            return await f.fetch(url, site)
        finally:
            await client.aclose()
    return asyncio.run(go())


def test_fetcher_respects_robots_and_redirects():
    def robots_block(req):
        if req.url.path == '/robots.txt':
            return httpx.Response(200, text='User-agent: *\nDisallow: /private')
        return httpx.Response(200, headers={'content-type': 'text/html'}, text='<html>ok</html>')
    assert _fetch(robots_block, 'https://acme.com/private/x').error == 'robots_disallowed'
    assert _fetch(robots_block, 'https://acme.com/about').ok

    def robots_down(req):
        return httpx.Response(503) if req.url.path == '/robots.txt' else httpx.Response(200, text='x')
    assert _fetch(robots_down, 'https://acme.com/').error == 'robots_disallowed'   # cannot verify -> do not fetch

    def offsite(req):
        if req.url.path == '/robots.txt':
            return httpx.Response(404)
        if req.url.host == 'acme.com':
            return httpx.Response(302, headers={'location': 'https://www.linkedin.com/company/acme'})
        return httpx.Response(200, headers={'content-type': 'text/html'}, text='<html>li</html>')
    assert _fetch(offsite, 'https://acme.com/about').error == 'offsite_redirect'


# ---- Wikidata source + JS render fallback --------------------------------------------------------
from company_intel import wikidata as wd


def _entity(site='https://www.acme.com/'):
    return {'labels': {'en': {'value': 'Acme'}}, 'descriptions': {'en': {'value': 'Indian software company'}},
            'claims': {
                'P856': [{'mainsnak': {'datavalue': {'value': site}}}],
                'P571': [{'mainsnak': {'datavalue': {'value': {'time': '+1968-04-01T00:00:00Z'}}}}],
                'P159': [{'mainsnak': {'datavalue': {'value': {'id': 'Q1156'}}}}],
                'P1128': [{'mainsnak': {'datavalue': {'value': {'amount': '+600000'}}},
                           'qualifiers': {'P585': [{'datavalue': {'value': {'time': '+2023-01-01T00:00:00Z'}}}]}}]}}


def test_wikidata_text_uses_only_stated_statements():
    text = wd.build_text(_entity(), {'Q1156': 'Mumbai'}, 'Acme')
    assert 'founded in 1968' in text and 'Headquarters: Mumbai' in text and '600000 (as of 2023)' in text
    assert wd.website_matches(_entity(), 'acme.com') and not wd.website_matches(_entity('https://other.com'), 'acme.com')


def _wd_client(search_hits, entity):
    def handler(request):
        q = dict(request.url.params)
        if q.get('list') == 'search':
            return httpx.Response(200, json={'query': {'search': [{'title': t} for t in search_hits]}})
        if q.get('props') == 'labels':
            return httpx.Response(200, json={'entities': {'Q1156': {'labels': {'en': {'value': 'Mumbai'}}}}})
        return httpx.Response(200, json={'entities': {'Q42': entity}})
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _run_wd(hits, entity, domain='acme.com'):
    async def go():
        async with _wd_client(hits, entity) as c:
            return await wd.WikidataSource(c, delay_s=0).fetch(domain, 'Acme')
    return asyncio.run(go())


def test_wikidata_fetch_matches_and_refuses_ambiguity_or_wrong_site():
    doc = _run_wd(['Q42'], _entity())
    assert doc and doc['url'] == 'https://www.wikidata.org/wiki/Q42' and 'Mumbai' in doc['text']
    assert _run_wd(['Q42', 'Q43'], _entity()) is None            # ambiguous -> never guess
    assert _run_wd([], _entity()) is None
    assert _run_wd(['Q42'], _entity('https://different.org')) is None   # P856 must equal our verified domain


def test_wikidata_sources_sort_first_in_prompt_budget():
    srcs = [{'url': 'https://acme.com/about', 'topic_hint': 'overview'},
            {'url': 'https://www.wikidata.org/wiki/Q42', 'topic_hint': 'overview'}]
    assert sources_for_topic(TOPIC_BY_KEY['overview'], srcs)[0]['url'].startswith('https://www.wikidata.org/')


class _FakeRenderer:
    def __init__(self):
        self.calls = 0

    async def render(self, url, user_agent):
        self.calls += 1
        return '<html><body><main><p>' + 'Real rendered company content. ' * 20 + '</p></main></body></html>', url


def _fetch_with_renderer(shell_html, renderer):
    def handler(request):
        if request.url.path == '/robots.txt':
            return httpx.Response(404)
        return httpx.Response(200, text=shell_html, headers={'content-type': 'text/html'})

    async def go():
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
        f = PoliteFetcher(client=client, delay_s=0, renderer=renderer)
        return await f.fetch('https://acme.com/about', 'acme.com')
    return asyncio.run(go())


def test_render_fallback_only_for_empty_shells():
    r = _FakeRenderer()
    shell = _fetch_with_renderer('<html><body><div id="root"></div><script src="/app.js"></script></body></html>', r)
    assert shell.rendered and r.calls == 1 and 'Real rendered' in shell.html
    r2 = _FakeRenderer()
    full = _fetch_with_renderer('<html><body><main><p>' + 'Plenty of server rendered text here. ' * 15 + '</p></main></body></html>', r2)
    assert not full.rendered and r2.calls == 0

