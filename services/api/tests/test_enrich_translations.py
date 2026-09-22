"""enrich_all_content.py --target translations: job_translations backfill
(IMPLEMENTATION_PLAN.md §7). No rule-based fallback exists here, unlike
jobs/structured, so the interesting behavior is: candidates are gated by
the same freshness/quality tier as the sitemap, a missing GROQ_API_KEY
always refuses to run (not just under --no-fallback), and a translate()
result of None (Groq unavailable/unparseable for that row) is skipped
rather than writing anything.
"""
import argparse
import asyncio
import importlib
import pathlib
import sys
import types

import pytest

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / 'scripts'
SRC = pathlib.Path(__file__).resolve().parents[1] / 'src'


@pytest.fixture
def mod(monkeypatch):
    monkeypatch.syspath_prepend(str(SRC))
    monkeypatch.syspath_prepend(str(SCRIPTS))
    cfg = types.ModuleType('configs.config')
    cfg.settings = types.SimpleNamespace(GROQ_API_KEY='k', DATABASE_URL='postgresql://fake')
    monkeypatch.setitem(sys.modules, 'configs.config', cfg)
    for name in ('enrich_all_content', 'routes.jobs', 'configs.db'):
        sys.modules.pop(name, None)
    return importlib.import_module('enrich_all_content')


class FakePool:
    def __init__(self, candidate_rows):
        self.candidate_rows = candidate_rows
        self.executes = []

    async def fetch(self, sql, *params):
        assert sql == self._sql
        return self.candidate_rows

    async def execute(self, sql, *params):
        self.executes.append((sql, params))


def _args(**overrides):
    ns = argparse.Namespace(limit=100, bulk=False, dry_run=False, max_runtime_minutes=0)
    ns.deadline = None
    for k, v in overrides.items():
        setattr(ns, k, v)
    return ns


def test_translations_target_is_registered_and_not_in_all(mod):
    src = (SCRIPTS / 'enrich_all_content.py').read_text()
    assert "choices=['jobs', 'structured', 'companies', 'translations', 'all']" in src
    assert "args.target == 'translations'" in src


def test_missing_key_always_refuses_even_without_no_fallback(mod, monkeypatch):
    class Disabled:
        enabled = False

    monkeypatch.setattr(mod, 'TranslationEnrichmentService', lambda: Disabled())
    parser = argparse.ArgumentParser()
    monkeypatch.setattr(sys, 'argv', ['enrich_all_content.py', '--target', 'translations'])
    with pytest.raises(SystemExit) as exc:
        asyncio.run(mod.main())
    assert exc.value.code == 2


def test_candidate_sql_mirrors_sitemap_tiers(mod):
    sql = mod.TRANSLATIONS_CANDIDATES_SQL
    assert 'enriched_overview IS NOT NULL' in sql
    assert "interval '30 days'" in sql
    assert "interval '90 days'" in sql
    assert '>= 50' in sql
    assert '>= 75' in sql
    assert 'COALESCE(posted_at, last_seen_at)' in sql
    # Only re-translates a row when the English content was re-enriched
    # more recently than the existing translation -- not on every run.
    assert 'e.enriched_at > jt.translated_at' in sql


def test_enrich_translations_writes_upsert_for_each_successful_result(mod, monkeypatch):
    rows = [
        {'id': 'job1', 'title': 'Backend Intern', 'enriched_overview': 'overview',
         'structured_description': None, 'locale': 'es'},
        {'id': 'job1', 'title': 'Backend Intern', 'enriched_overview': 'overview',
         'structured_description': None, 'locale': 'pt'},
    ]
    pool = FakePool(rows)
    pool._sql = mod.TRANSLATIONS_CANDIDATES_SQL

    class FakeResult:
        def __init__(self, locale):
            self.title = f'Backend Intern ({locale})'
            self.overview = f'overview ({locale})'
            self.structured_description = None
            self.model = 'openai/gpt-oss-120b'

    class FakeService:
        enabled = True

        async def translate(self, *, title, overview, structured_description, locale):
            return FakeResult(locale)

    monkeypatch.setattr(mod, 'TranslationEnrichmentService', FakeService)
    out = asyncio.run(mod.enrich_translations(pool, _args()))
    assert out == {'attempted': 2, 'enriched': 2, 'stopped_early': False}
    assert len(pool.executes) == 2
    locales_written = {p[1] for sql, p in pool.executes}
    assert locales_written == {'es', 'pt'}


def test_enrich_translations_skips_none_results_without_writing(mod, monkeypatch):
    rows = [{'id': 'job1', 'title': 'X', 'enriched_overview': 'y', 'structured_description': None, 'locale': 'es'}]
    pool = FakePool(rows)
    pool._sql = mod.TRANSLATIONS_CANDIDATES_SQL

    class FakeService:
        enabled = True

        async def translate(self, **kwargs):
            return None

    monkeypatch.setattr(mod, 'TranslationEnrichmentService', FakeService)
    out = asyncio.run(mod.enrich_translations(pool, _args()))
    assert out == {'attempted': 1, 'enriched': 0, 'stopped_early': False}
    assert pool.executes == []


def test_dry_run_does_not_write(mod, monkeypatch):
    rows = [{'id': 'job1', 'title': 'X', 'enriched_overview': 'y', 'structured_description': None, 'locale': 'es'}]
    pool = FakePool(rows)
    pool._sql = mod.TRANSLATIONS_CANDIDATES_SQL

    class FakeResult:
        title, overview, structured_description, model = 'X (es)', 'y (es)', None, 'openai/gpt-oss-120b'

    class FakeService:
        enabled = True

        async def translate(self, **kwargs):
            return FakeResult()

    monkeypatch.setattr(mod, 'TranslationEnrichmentService', FakeService)
    out = asyncio.run(mod.enrich_translations(pool, _args(dry_run=True)))
    assert out['enriched'] == 1
    assert pool.executes == []
