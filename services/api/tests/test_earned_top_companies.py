# Covers routes/jobs.py's _top_companies(): TOP_COMPANY_TIER is now a cold-start
# seed, unioned with a DB-computed "earned" set (enough recent, high-confidence
# active postings), cached in-process for _TOP_COMPANIES_TTL_S.
import sys
import types
from unittest.mock import patch

import pytest

if 'configs.config' not in sys.modules:
    fake_config = types.ModuleType('configs.config')

    class _Settings:
        DATABASE_URL = 'postgresql://fake'

    fake_config.settings = _Settings()
    sys.modules['configs.config'] = fake_config

from routes import jobs as jobs_module  # noqa: E402


class FakePool:
    def __init__(self, earned_rows):
        self.earned_rows = earned_rows
        self.fetch_calls = 0

    async def fetch(self, sql, *params):
        self.fetch_calls += 1
        return self.earned_rows


@pytest.fixture(autouse=True)
def reset_cache():
    jobs_module._TOP_COMPANIES_CACHE['at'] = 0.0
    jobs_module._TOP_COMPANIES_CACHE['value'] = None
    yield
    jobs_module._TOP_COMPANIES_CACHE['at'] = 0.0
    jobs_module._TOP_COMPANIES_CACHE['value'] = None


def test_unions_seed_and_earned():
    pool = FakePool([{'company': 'a-new-hiring-startup'}])
    import asyncio
    result = asyncio.run(jobs_module._top_companies(pool))
    assert 'google' in result  # from the static seed
    assert 'a-new-hiring-startup' in result  # earned from data


def test_caches_across_calls():
    import asyncio
    pool = FakePool([{'company': 'x'}])
    asyncio.run(jobs_module._top_companies(pool))
    asyncio.run(jobs_module._top_companies(pool))
    assert pool.fetch_calls == 1


def test_falls_back_to_seed_on_query_failure():
    import asyncio

    class BrokenPool:
        async def fetch(self, sql, *params):
            raise RuntimeError('db down')

    result = asyncio.run(jobs_module._top_companies(BrokenPool()))
    assert 'google' in result
