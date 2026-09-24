# Module: services/api/tests/test_gone_ids.py
# Covers GET /api/jobs/gone-ids -- the bulk companion to GET /{job_id}/status
# used by the web middleware's 410 check (apps/web/lib/goneJobs.ts). DB
# access is mocked, same FakePool pattern as test_jobs_facets.py.

import sys
import types
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

if 'configs.config' not in sys.modules:
    fake_config = types.ModuleType('configs.config')

    class _Settings:
        DATABASE_URL = 'postgresql://fake'

    fake_config.settings = _Settings()
    sys.modules['configs.config'] = fake_config

from routes import jobs as jobs_module  # noqa: E402


class FakePool:
    def __init__(self, rows=None):
        self.rows = rows if rows is not None else [{'id': 'a' * 16}, {'id': 'b' * 16}]
        self.calls = []

    async def fetch(self, sql, *params):
        self.calls.append(('fetch', sql, params))
        return self.rows

    async def fetchrow(self, sql, *params):
        self.calls.append(('fetchrow', sql, params))
        return None


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(jobs_module.router)
    return TestClient(app)


def _patched(fake_pool):
    async def fake_get_db_pool():
        return fake_pool

    return patch.object(jobs_module, 'get_db_pool', fake_get_db_pool)


def test_returns_ids_list():
    fake_pool = FakePool()
    with _patched(fake_pool):
        app = FastAPI()
        app.include_router(jobs_module.router)
        resp = TestClient(app).get('/api/jobs/gone-ids')
    assert resp.status_code == 200
    assert resp.json() == {'ids': ['a' * 16, 'b' * 16]}


def test_default_is_unbounded_by_time(client):
    # No since_days -> every inactive job (bounded only by GONE_IDS_MAX_ROWS),
    # not just a recent window. A job deactivated 31+ days ago must still
    # come back, or the web middleware stops answering 410 for it and it
    # falls through to a plain 404 -- a weaker "gone" signal to Google.
    fake_pool = FakePool()
    with _patched(fake_pool):
        resp = client.get('/api/jobs/gone-ids')
    assert resp.status_code == 200
    fetch_call = next(c for c in fake_pool.calls if c[0] == 'fetch')
    sql, params = fetch_call[1], fetch_call[2]
    assert 'is_active = false' in sql
    assert 'last_seen_at > now()' not in sql  # no time filter -- ORDER BY last_seen_at is fine
    assert params[0] == jobs_module.GONE_IDS_MAX_ROWS


def test_since_days_still_available_and_scopes_to_recent(client):
    fake_pool = FakePool()
    with _patched(fake_pool):
        resp = client.get('/api/jobs/gone-ids', params={'since_days': 7})
    assert resp.status_code == 200
    fetch_call = next(c for c in fake_pool.calls if c[0] == 'fetch')
    sql, params = fetch_call[1], fetch_call[2]
    assert 'is_active = false' in sql
    assert 'last_seen_at > now()' in sql
    assert params[0] == 7
    assert params[1] == jobs_module.GONE_IDS_MAX_ROWS


def test_since_days_is_bounded_when_given(client):
    fake_pool = FakePool()
    with _patched(fake_pool):
        too_high = client.get('/api/jobs/gone-ids', params={'since_days': 999})
        too_low = client.get('/api/jobs/gone-ids', params={'since_days': 0})
    assert too_high.status_code == 422
    assert too_low.status_code == 422


def test_registered_before_job_id_catchall(client):
    # /gone-ids must resolve to get_gone_ids, not get_job('gone-ids')
    fake_pool = FakePool()
    with _patched(fake_pool):
        resp = client.get('/api/jobs/gone-ids')
    assert resp.status_code == 200
    assert 'ids' in resp.json()


def test_db_unavailable_returns_503(client):
    async def fake_get_db_pool():
        return None

    with patch.object(jobs_module, 'get_db_pool', fake_get_db_pool):
        resp = client.get('/api/jobs/gone-ids')
    assert resp.status_code == 503
