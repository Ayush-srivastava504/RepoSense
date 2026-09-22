# Module: services/api/tests/test_job_translation_locale.py
# Covers GET /api/jobs/{id}?locale=xx (job_translations, migrations/024) —
# the API side of IMPLEMENTATION_PLAN.md §7's locale-aware job content.

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

JOB_ROW = {
    'id': 'a' * 16, 'title': 'Backend Intern', 'company': 'Acme', 'description': 'x' * 200,
    'url': 'https://example.com/apply', 'source': 'test', 'posted_at': None, 'created_at': None,
    'location': None, 'salary': None, 'stipend': None, 'type': 'internship', 'deadline': None,
    'confidence_score': None, 'confidence_label': None, 'apply_domain': None, 'logo_domain': None,
    'is_official_domain': False, 'is_remote': False, 'is_government': False, 'country': None,
    'department': None, 'vacancies': None, 'notification_number': None, 'job_group': None,
    'last_seen_at': None, 'enriched_overview': 'English overview', 'enriched_keywords': None,
    'allowed_degrees': None, 'allowed_courses': None, 'allowed_specializations': None,
    'allowed_passout_years': None, 'required_skills': None, 'notes_highlights': None,
    'work_mode': None, 'experience_min': None, 'experience_max': None, 'job_function': None,
    'structured_description': 'English structured', 'is_thin': False, 'quality_score': 80,
    'is_new': False, 'is_top_company': False, 'is_verified_source': False, 'is_hot': False, 'is_stale': False,
}


class FakePool:
    def __init__(self, job_row=None, translation_locales=None, translation_row=None):
        self.job_row = job_row
        self.translation_locales = translation_locales or []
        self.translation_row = translation_row
        self.calls = []

    async def fetchrow(self, sql, *params):
        self.calls.append(('fetchrow', sql, params))
        if 'FROM jobs' in sql:
            return self.job_row
        if 'FROM job_translations' in sql:
            return self.translation_row
        return None

    async def fetch(self, sql, *params):
        self.calls.append(('fetch', sql, params))
        return [{'locale': loc} for loc in self.translation_locales]


def _patched(fake_pool):
    async def fake_get_db_pool():
        return fake_pool

    return patch.object(jobs_module, 'get_db_pool', fake_get_db_pool)


def _client():
    app = FastAPI()
    app.include_router(jobs_module.router)
    return TestClient(app)


def test_no_locale_param_returns_english_with_empty_translated_locales():
    pool = FakePool(job_row=JOB_ROW, translation_locales=[])
    with _patched(pool):
        resp = _client().get(f"/api/jobs/{JOB_ROW['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body['title'] == 'Backend Intern'
    assert body['translated_locales'] == []
    assert 'content_locale' not in body


def test_translated_locales_lists_available_locales_regardless_of_query():
    pool = FakePool(job_row=JOB_ROW, translation_locales=['es', 'pt'])
    with _patched(pool):
        resp = _client().get(f"/api/jobs/{JOB_ROW['id']}")
    assert resp.status_code == 200
    assert resp.json()['translated_locales'] == ['es', 'pt']


def test_locale_with_translation_overrides_title_and_overview():
    pool = FakePool(
        job_row=JOB_ROW, translation_locales=['es'],
        translation_row={'title': 'Pasante de Backend', 'overview': 'Resumen en español', 'structured_description': None},
    )
    with _patched(pool):
        resp = _client().get(f"/api/jobs/{JOB_ROW['id']}", params={'locale': 'es'})
    assert resp.status_code == 200
    body = resp.json()
    assert body['title'] == 'Pasante de Backend'
    assert body['enriched_overview'] == 'Resumen en español'
    assert body['content_locale'] == 'es'
    # structured_description was null in the translation row -> keeps the English one.
    assert body['structured_description'] == 'English structured'


def test_locale_with_no_translation_falls_back_to_english_untouched():
    pool = FakePool(job_row=JOB_ROW, translation_locales=['es'])  # 'fr' not in the list
    with _patched(pool):
        resp = _client().get(f"/api/jobs/{JOB_ROW['id']}", params={'locale': 'fr'})
    assert resp.status_code == 200
    body = resp.json()
    assert body['title'] == 'Backend Intern'
    assert body['enriched_overview'] == 'English overview'
    assert 'content_locale' not in body


def test_404_job_never_queries_translations():
    pool = FakePool(job_row=None)
    with _patched(pool):
        resp = _client().get(f"/api/jobs/{JOB_ROW['id']}")
    assert resp.status_code == 404
    assert not any(c[0] == 'fetch' and 'job_translations' in c[1] for c in pool.calls)
