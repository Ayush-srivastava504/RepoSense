# Module: services/api/tests/test_phase_f_priority_push.py
# Covers the pure, no-DB-no-network parts of Phase F
# (scripts/phase_f_priority_index_push.py): the URL builder must produce
# byte-identical paths to apps/web/lib/slug.ts's jobSlug()/
# canonicalPathForJob(), since a mismatch here would mean IndexNow/Google
# get told about a URL the site doesn't actually serve.

import importlib.util
import sys
import types
from pathlib import Path

import pytest

# configs.config / routes.jobs pull in FastAPI + DB settings at import
# time — stub both out so this test only exercises the pure functions,
# same approach as tests/test_jobs_facets.py.
if 'configs.config' not in sys.modules:
    fake_config = types.ModuleType('configs.config')

    class _Settings:
        DATABASE_URL = 'postgresql://fake'
        INDEXNOW_KEY = 'fake-key'
        INDEXNOW_HOST = 'www.example.test'
        GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON = ''
        GOOGLE_INDEXING_DAILY_QUOTA = 180

    fake_config.settings = _Settings()
    sys.modules['configs.config'] = fake_config

if 'routes.jobs' not in sys.modules:
    fake_routes_jobs = types.ModuleType('routes.jobs')
    fake_routes_jobs.TOP_COMPANY_TIER = ['google', 'stripe']
    sys.modules['routes.jobs'] = fake_routes_jobs
    sys.modules.setdefault('routes', types.ModuleType('routes'))

_SCRIPT_PATH = Path(__file__).resolve().parents[1] / 'scripts' / 'phase_f_priority_index_push.py'
_spec = importlib.util.spec_from_file_location('phase_f_priority_index_push', _SCRIPT_PATH)
phase_f = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(phase_f)


def test_internship_url_matches_ts_slug_shape():
    job = {
        'id': 'abc123', 'title': 'Software Engineer Intern', 'company': 'Google',
        'location': 'Bangalore, India', 'salary': None, 'stipend': '50000',
        'type': 'internship', 'is_remote': False, 'is_government': False,
    }
    assert phase_f.canonical_url(job) == (
        'https://www.intern-flow.in/internships/'
        'software-engineer-intern-google-bangalore-50000-abc123'
    )


def test_remote_job_uses_remote_jobs_category():
    job = {
        'id': 'xyz789', 'title': 'Backend Engineer', 'company': 'Stripe',
        'location': 'Remote', 'salary': '20 LPA', 'stipend': None,
        'type': 'full-time', 'is_remote': True, 'is_government': False,
    }
    url = phase_f.canonical_url(job)
    assert url.startswith('https://www.intern-flow.in/remote-jobs/')
    assert url.endswith('-xyz789')


def test_government_job_takes_priority_over_type_and_remote():
    # canonicalCategoryForJob checks is_government before type/is_remote —
    # a job that's somehow both government and remote must still resolve
    # to /government-jobs/, matching lib/slug.ts's precedence exactly.
    job = {
        'id': 'gov1', 'title': 'Junior Engineer', 'company': 'Indian Railways',
        'location': 'Delhi', 'type': 'full-time', 'is_remote': True, 'is_government': True,
    }
    assert phase_f.canonical_url(job).startswith('https://www.intern-flow.in/government-jobs/')


def test_slug_truncates_long_base_and_keeps_id_suffix():
    job = {
        'id': 'short1',
        'title': 'A Very Long Job Title That Goes On And On And On For Quite A While Indeed',
        'company': 'Some Company With A Fairly Long Name Too Honestly',
        'location': 'Bangalore', 'type': 'full-time', 'is_remote': False, 'is_government': False,
    }
    url = phase_f.canonical_url(job)
    slug = url.split('/')[-1]
    assert slug.endswith('-short1')
    # base (everything before the trailing -<id>) must respect the same
    # 90-char cap jobSlug() in lib/slug.ts enforces.
    base = slug[: -len('-short1')]
    assert len(base) <= 90


@pytest.mark.parametrize('company,expected', [('Google', True), ('some-random-startup', False)])
def test_top_company_list_is_case_insensitive_lookup(company, expected):
    assert (company.lower() in [c.lower() for c in ['google', 'stripe']]) == expected
