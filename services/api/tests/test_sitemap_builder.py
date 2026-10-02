from datetime import datetime, timedelta, timezone
import pytest
from services import sitemap_builder as sb

NOW = datetime(2026, 9, 28, tzinfo=timezone.utc)


def job(i, days=5, **kw):
    d = dict(id=f'id{i}', title='Data Analyst', company='Acme & Co', location='Pune, IN', salary=None, stipend=None,
             type='full-time', is_remote=False, is_government=False, deadline=None,
             posted_at=NOW - timedelta(days=days), created_at=NOW - timedelta(days=days),
             last_seen_at=NOW, is_thin=False, quality_score=0, has_overview=True)
    d.update(kw)
    return d


def test_slug_matches_ts():
    assert sb.job_slug(job(1)) == 'data-analyst-acme-co-pune-id1'
    assert sb.job_slug(job(1, salary='8 LPA')) == 'data-analyst-acme-co-pune-8-lpa-id1'


def test_tiers():
    assert sb.is_job_for_sitemap(job(1, days=10), NOW)
    future = NOW + timedelta(days=3)  # without a deadline, >45d old is stale (noindex) and excluded
    assert not sb.is_job_for_sitemap(job(1, days=60, quality_score=90), NOW)
    assert not sb.is_job_for_sitemap(job(1, days=60, quality_score=49, deadline=future), NOW)
    assert sb.is_job_for_sitemap(job(1, days=60, quality_score=50, deadline=future), NOW)
    assert not sb.is_job_for_sitemap(job(1, days=120, quality_score=74, deadline=future), NOW)
    assert sb.is_job_for_sitemap(job(1, days=120, quality_score=75, deadline=NOW + timedelta(days=3)), NOW)


def test_excludes_unenriched_stale_and_thin():
    assert not sb.is_job_for_sitemap(job(1, has_overview=False), NOW)
    assert not sb.is_job_for_sitemap(job(1, deadline=NOW - timedelta(days=1)), NOW)
    assert not sb.is_job_for_sitemap(job(1, posted_at=None, last_seen_at=None), NOW)


def test_categories_chunking_and_xml():
    jobs = [job(1, type='internship'), job(2, is_remote=True), job(3, is_government=True), job(4)]
    files = sb.build_files(jobs, NOW)
    assert set(files) == {'jobs-1.xml', 'internships-1.xml', 'remote-jobs-1.xml', 'government-jobs-1.xml'}
    assert 'Acme-' not in files['jobs-1.xml'][3] and 'acme-co' in files['jobs-1.xml'][3]
    assert '<lastmod>2026-09-23T00:00:00.000Z</lastmod>' in files['jobs-1.xml'][3]
    many = sb.build_files([job(i) for i in range(2500)], NOW)
    assert [many[f'jobs-{p}.xml'][2] for p in (1, 2, 3)] == [1000, 1000, 500]


def test_dedupes_ids():
    assert sb.build_files([job(1), job(1)], NOW)['jobs-1.xml'][2] == 1


# --- Phase 8: sitemap_categories registry -------------------------------------

def _mixed():
    return [job(1, type='internship'), job(2, is_remote=True), job(3, is_government=True), job(4)]


def test_registry_disables_a_job_category():
    files = sb.build_files(_mixed(), NOW, enabled=['jobs', 'internships', 'remote-jobs'])
    assert not any(n.startswith('government-jobs') for n in files)
    assert {'jobs-1.xml', 'internships-1.xml', 'remote-jobs-1.xml'} <= set(files)


def test_enabled_none_keeps_all_categories():
    files = sb.build_files(_mixed(), NOW)
    assert {c for c, *_ in files.values()} == set(sb.CATEGORIES)


def test_enabled_job_categories_from_registry_rows():
    reg = [
        {'slug': 'jobs', 'kind': 'job_cache', 'enabled': True},
        {'slug': 'government-jobs', 'kind': 'job_cache', 'enabled': False},
        {'slug': 'skills', 'kind': 'route', 'enabled': True},
        {'slug': 'bogus-jobs', 'kind': 'job_cache', 'enabled': True},  # unknown slug ignored
    ]
    assert sb.enabled_job_categories(reg) == ['jobs']
    assert sb.enabled_job_categories([]) == list(sb.CATEGORIES)  # empty/unavailable registry -> old behaviour


class _Pool:
    def __init__(self, rows=None, boom=False):
        self.rows, self.boom = rows, boom

    async def fetch(self, sql, *a):
        if self.boom:
            raise RuntimeError('relation "sitemap_categories" does not exist')
        return self.rows


def test_load_registry_survives_missing_table():
    import asyncio
    assert asyncio.run(sb.load_registry(_Pool(boom=True))) == []
    assert asyncio.run(sb.load_registry(_Pool(rows=[{'slug': 'jobs', 'kind': 'job_cache', 'enabled': True}]))) == [
        {'slug': 'jobs', 'kind': 'job_cache', 'enabled': True}]
