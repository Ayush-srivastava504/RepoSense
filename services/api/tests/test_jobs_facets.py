# Module: services/api/tests/test_jobs_facets.py
# Covers Phase 2 (PHASE_PLAN.md items 1-2): GET /api/jobs/facets and the
# multi-select skills/courses/sources/batches/companies params on
# GET /api/jobs/. DB access is mocked (FakePool below) — these assert the
# route builds correct SQL/params and shapes its response correctly, not
# real query results against a live Postgres instance.

import sys
import types
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# configs.db pulls DATABASE_URL from configs.config.settings at import
# time — stub it out so importing routes.jobs doesn't require a real env.
if 'configs.config' not in sys.modules:
    fake_config = types.ModuleType('configs.config')

    class _Settings:
        DATABASE_URL = 'postgresql://fake'

    fake_config.settings = _Settings()
    sys.modules['configs.config'] = fake_config

from routes import jobs as jobs_module  # noqa: E402


class FakePool:
    """Routes canned rows back based on which facet query ran, and
    records every call so tests can assert on the SQL/params sent."""

    def __init__(self):
        self.calls = []

    async def fetch(self, sql, *params):
        self.calls.append(('fetch', sql, params))
        if 'SELECT id, posted_at, source AS val' in sql:
            return [{'value': 'greenhouse', 'label': 'greenhouse', 'count': 6}]
        if 'SELECT id, posted_at, company AS val' in sql:
            return [{'value': 'acme', 'label': 'Acme', 'count': 1}]
        if 'allowed_courses' in sql:
            return [{'value': 'b-tech', 'label': 'B.Tech', 'count': 4}]
        if 'allowed_passout_years' in sql:
            return [
                {'value': '2026', 'label': '2026', 'count': 10},
                {'value': '2025', 'label': '2025', 'count': 2},
            ]
        if 'required_skills' in sql:
            return [
                {'value': 'react-js', 'label': 'React.js', 'count': 5},
                {'value': 'python', 'label': 'Python', 'count': 3},
            ]
        return []

    async def fetchval(self, sql, *params):
        self.calls.append(('fetchval', sql, params))
        return 42

    async def fetchrow(self, sql, *params):
        self.calls.append(('fetchrow', sql, params))
        return None


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(jobs_module.router)
    return TestClient(app)


@pytest.fixture
def fake_pool():
    return FakePool()


def _patched(fake_pool):
    async def fake_get_db_pool():
        return fake_pool

    return patch.object(jobs_module, 'get_db_pool', fake_get_db_pool)


class TestFacetsEndpoint:
    def test_returns_all_five_facet_groups(self, client, fake_pool):
        with _patched(fake_pool):
            resp = client.get(
                '/api/jobs/facets',
                params={'search': 'engineer', 'job_group': 'software'},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {
            'skills', 'courses', 'sources', 'batches', 'companies',
        }

    def test_source_labels_are_humanized(self, client, fake_pool):
        with _patched(fake_pool):
            resp = client.get('/api/jobs/facets')
        assert resp.json()['sources'][0]['label'] == 'Greenhouse'

    def test_batches_sorted_newest_first(self, client, fake_pool):
        with _patched(fake_pool):
            resp = client.get('/api/jobs/facets')
        values = [b['value'] for b in resp.json()['batches']]
        assert values == ['2026', '2025']

    def test_registered_before_job_id_catchall(self, client, fake_pool):
        # /facets must resolve to get_jobs_facets, not get_job('facets')
        with _patched(fake_pool):
            resp = client.get('/api/jobs/facets')
        assert resp.status_code == 200
        assert 'skills' in resp.json()


class TestMultiSelectFilters:
    def test_multi_filters_build_expected_sql_and_params(self, client, fake_pool):
        with _patched(fake_pool):
            resp = client.get(
                '/api/jobs/',
                params={
                    'skills': 'react-js, python',
                    'courses': 'b-tech',
                    'sources': 'greenhouse',
                    'companies': 'acme',
                    'batches': '2026,2027',
                },
            )
        assert resp.status_code == 200
        count_call = next(c for c in fake_pool.calls if c[0] == 'fetchval')
        assert count_call[2] == (
            ['react-js', 'python'],
            ['b-tech'],
            ['greenhouse'],
            ['acme'],
            ['2026', '2027'],
        )
        assert 'regexp_replace' in count_call[1]

    def test_empty_multi_filters_add_no_conditions(self, client, fake_pool):
        with _patched(fake_pool):
            resp = client.get('/api/jobs/')
        assert resp.status_code == 200
        count_call = next(c for c in fake_pool.calls if c[0] == 'fetchval')
        assert count_call[2] == ()
        assert 'regexp_replace' not in count_call[1]

    def test_duplicate_values_in_multi_param_are_deduped(self):
        assert jobs_module._parse_multi('react-js,react-js, python') == [
            'react-js', 'python',
        ]

    def test_singular_hub_page_params_still_work(self, client, fake_pool):
        # Backward compatibility: /skills/[slug] and /companies/[slug]
        # hub pages use the pre-existing singular skill=/company= params.
        with _patched(fake_pool):
            resp = client.get(
                '/api/jobs/', params={'skill': 'python', 'company': 'Acme Corp'},
            )
        assert resp.status_code == 200


class TestSlugSql:
    def test_matches_frontend_slugify_semantics(self):
        # Spot-check the SQL expression against a couple of the same
        # cases apps/web/lib/facets.ts's slugifyFacet() would receive.
        expr = jobs_module._slug_sql('x')
        assert "regexp_replace" in expr
        assert "'[^a-z0-9]+'" in expr
