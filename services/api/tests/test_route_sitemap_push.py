from services import route_sitemap_push as rsp

XML = '''<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://x.in/a</loc><lastmod>2026-09-01T00:00:00.000Z</lastmod><priority>0.7</priority></url>
  <url><loc>https://x.in/b</loc></url>
</urlset>'''


def test_parse_sitemap_with_and_without_lastmod():
    assert rsp.parse_sitemap(XML) == {'https://x.in/a': '2026-09-01T00:00:00.000Z', 'https://x.in/b': ''}
    assert rsp.parse_sitemap('') == {}
    assert rsp.parse_sitemap('<sitemapindex><sitemap><loc>https://x.in/s.xml</loc></sitemap></sitemapindex>') == {}


def test_diff_new_changed_removed():
    known = {'/a': 'v1', '/b': 'v1', '/gone': 'v1'}
    current = {'/a': 'v2', '/b': 'v1', '/new': 'v1'}
    assert rsp.diff(known, current) == (['/new'], ['/a'], ['/gone'])


def test_no_lastmod_pushed_once_only():
    known = {'/static': ''}
    assert rsp.diff(known, {'/static': ''}) == ([], [], [])          # unchanged, nothing to resubmit
    assert rsp.diff({}, {'/static': ''}) == (['/static'], [], [])    # first sight -> submit


def test_empty_sitemap_never_means_everything_deleted():
    known = {f'/u{i}': '' for i in range(10)}
    p = rsp.plan(known, {})
    assert p['removed'] == [] and len(p['skipped_removals']) == 10


def test_mass_disappearance_is_treated_as_broken_sitemap():
    known = {f'/u{i}': '' for i in range(10)}
    current = {f'/u{i}': '' for i in range(3)}                       # 7 of 10 vanished
    p = rsp.plan(known, current)
    assert p['removed'] == [] and len(p['skipped_removals']) == 7
    current = {f'/u{i}': '' for i in range(8)}                       # 2 of 10 vanished -> real removals
    assert rsp.plan(known, current)['removed'] == ['/u8', '/u9']


def test_chunks_respect_indexnow_limit():
    urls = [f'/u{i}' for i in range(25000)]
    assert [len(c) for c in rsp.chunks(urls)] == [10000, 10000, 5000]
