# Module: services/api/tests/test_gone_urls.py
# Covers GET /api/jobs/gone-urls -- companion to /gone-ids that returns
# slug-building fields (not just ids) for IndexNow submission. Same
# FakePool pattern as test_gone_ids.py.

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

_FAKE_JOB = {
    'id': 'a' * 16,
    'title': 'Software Engineer Intern',
    'company': 'Acme Corp',
    'location': 'Bangalore, India',
    'salary': None,
    'stipend': '25000',
    'type': 'internship',
    'is_remote': False,
    'is_government': False,
}


class FakePool:
    def __init__(self, rows=None):
        self.rows = rows if rows is not None else [_FAKE_JOB]
        self.calls = []

    async def fetch(self, sql, *params):
        self.calls.append(('fetch', sql, params))
        return self.rows


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(jobs_module.router)
    return TestClient(app)


def _patched(fake_pool):
    async def fake_get_db_pool():
        return fake_pool

    return patch.object(jobs_module, 'get_db_pool', fake_get_db_pool)


def test_returns_job_fields_not_just_ids(client):
    fake_pool = FakePool()
    with _patched(fake_pool):
        resp = client.get('/api/jobs/gone-urls')
    assert resp.status_code == 200
    body = resp.json()
    assert body['jobs'][0]['title'] == 'Software Engineer Intern'
    assert body['jobs'][0]['company'] == 'Acme Corp'


def test_defaults_to_since_days_1(client):
    fake_pool = FakePool()
    with _patched(fake_pool):
        resp = client.get('/api/jobs/gone-urls')
    assert resp.status_code == 200
    fetch_call = next(c for c in fake_pool.calls if c[0] == 'fetch')
    sql, params = fetch_call[1], fetch_call[2]
    assert 'deactivated_at > now()' in sql
    assert 'is_active = false' in sql
    assert params[0] == 1
    assert params[1] == jobs_module.GONE_IDS_MAX_ROWS


def test_since_days_is_configurable_and_bounded(client):
    fake_pool = FakePool()
    with _patched(fake_pool):
        wider = client.get('/api/jobs/gone-urls', params={'since_days': 14})
        too_high = client.get('/api/jobs/gone-urls', params={'since_days': 999})
        too_low = client.get('/api/jobs/gone-urls', params={'since_days': 0})
    assert wider.status_code == 200
    assert too_high.status_code == 422
    assert too_low.status_code == 422


def test_db_unavailable_returns_503(client):
    async def fake_get_db_pool():
        return None

    with patch.object(jobs_module, 'get_db_pool', fake_get_db_pool):
        resp = client.get('/api/jobs/gone-urls')
    assert resp.status_code == 503
