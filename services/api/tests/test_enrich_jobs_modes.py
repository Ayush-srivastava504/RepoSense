"""enrich_all_content.py --target jobs: --redo-fallback / --no-fallback (the flags
job-content-enrichment.yml runs with), and the fail-fast when GROQ_API_KEY is missing."""
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
    for name in ('enrich_all_content', 'routes.jobs', 'configs.db', 'services.content_enrichment_service'):
        sys.modules.pop(name, None)
    module = importlib.import_module('enrich_all_content')
    monkeypatch.setattr(module, 'REQUEST_DELAY_S', 0)
    return module


class FakePool:
    def __init__(self, rows):
        self.rows, self.fetches, self.executes = rows, [], []

    async def fetch(self, sql, *params):
        self.fetches.append((sql, params))
        return self.rows

    async def execute(self, sql, *params):
        self.executes.append((sql, params))


ROW = {'id': 'a' * 16, 'title': 't', 'company': 'c', 'location': 'l', 'description': 'd', 'type': 'internship'}


def _install_service(mod, monkeypatch, models):
    """Replace ContentEnrichmentService with a fake that returns the given models in order
    (None = no result)."""
    seen = []

    class Svc:
        enabled = True

        async def enrich(self, **kw):
            seen.append(kw)
            model = models[len(seen) - 1]
            if model is None:
                return None
            return types.SimpleNamespace(overview='o', keywords=['k'], model=model)
    monkeypatch.setattr(mod, 'ContentEnrichmentService', Svc)
    return seen


def _args(**kw):
    return argparse.Namespace(**{'limit': 5, 'bulk': False, 'dry_run': False, 'no_fallback': False, 'redo_fallback': False, **kw})


def test_redo_fallback_selects_never_enriched_and_template_rows_newest_first(mod, monkeypatch):
    _install_service(mod, monkeypatch, ['llama'])
    pool = FakePool([ROW])
    asyncio.run(mod.enrich_jobs(pool, _args(redo_fallback=True)))
    sql = pool.fetches[0][0]
    assert "enriched_at IS NULL OR enriched_model = 'template-fallback'" in sql
    assert 'ORDER BY posted_at DESC NULLS LAST' in sql and 'is_active = true' in sql


def test_default_and_bulk_queries_are_unchanged(mod, monkeypatch):
    _install_service(mod, monkeypatch, ['llama', 'llama'])
    default, bulk = FakePool([ROW]), FakePool([ROW])
    asyncio.run(mod.enrich_jobs(default, _args()))
    asyncio.run(mod.enrich_jobs(bulk, _args(bulk=True)))
    assert 'AND enriched_at IS NULL ORDER BY posted_at DESC NULLS LAST' in default.fetches[0][0]
    assert 'ORDER BY enriched_at NULLS FIRST, posted_at DESC NULLS LAST' in bulk.fetches[0][0]


def test_no_fallback_is_passed_to_the_service_and_no_result_writes_nothing(mod, monkeypatch):
    seen = _install_service(mod, monkeypatch, [None])
    pool = FakePool([ROW])
    out = asyncio.run(mod.enrich_jobs(pool, _args(no_fallback=True)))
    assert seen[0]['allow_fallback'] is False
    assert pool.executes == [] and out['enriched'] == 0


def test_run_reports_ai_vs_fallback_counts(mod, monkeypatch):
    _install_service(mod, monkeypatch, ['llama', 'template-fallback'])
    pool = FakePool([ROW, {**ROW, 'id': 'b' * 16}])
    out = asyncio.run(mod.enrich_jobs(pool, _args()))
    assert (out['ai'], out['fallback'], out['enriched']) == (1, 1, 2)


def test_no_fallback_without_groq_key_refuses_to_run(mod, monkeypatch):
    class Svc:
        enabled = False
    monkeypatch.setattr(mod, 'ContentEnrichmentService', Svc)
    monkeypatch.setattr(sys, 'argv', ['enrich_all_content.py', '--target', 'jobs', '--no-fallback'])
    with pytest.raises(SystemExit) as exc:
        asyncio.run(mod.main())
    assert exc.value.code == 2


def test_workflow_uses_the_flags_and_old_workflow_is_gone(mod):
    root = SCRIPTS.parents[2] / '.github' / 'workflows'
    assert not (root / 'content-enrichment.yml').exists()
    text = (root / 'job-content-enrichment.yml').read_text()
    assert 'enrich_all_content.py' in text and '--no-fallback' in text and '--redo-fallback' in text
