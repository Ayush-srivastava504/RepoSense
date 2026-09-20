"""enrich_all_content.py structured backfill (phase-b-structured-backfill.yml): --no-fallback,
fallback results never overwriting an existing Groq structured description, the
--max-runtime-minutes budget, and the exit codes that make a bad run visible."""
import argparse
import asyncio
import importlib
import pathlib
import re
import sys
import types

import pytest

SCRIPTS = pathlib.Path(__file__).resolve().parents[1] / 'scripts'
SRC = pathlib.Path(__file__).resolve().parents[1] / 'src'
WORKFLOWS = SCRIPTS.parents[2] / '.github' / 'workflows'


@pytest.fixture
def mod(monkeypatch):
    monkeypatch.syspath_prepend(str(SRC))
    monkeypatch.syspath_prepend(str(SCRIPTS))
    cfg = types.ModuleType('configs.config')
    cfg.settings = types.SimpleNamespace(GROQ_API_KEY='k', DATABASE_URL='postgresql://fake')
    monkeypatch.setitem(sys.modules, 'configs.config', cfg)
    for name in ('enrich_all_content', 'routes.jobs', 'configs.db', 'services.content_enrichment_service',
                 'services.structured_enrichment_service'):
        sys.modules.pop(name, None)
    module = importlib.import_module('enrich_all_content')
    monkeypatch.setattr(module, 'REQUEST_DELAY_S', 0)
    return module


class FakePool:
    def __init__(self, rows, status=None):
        self.rows, self.fetches, self.executes, self.status = rows, [], [], status

    async def fetch(self, sql, *params):
        self.fetches.append((sql, params))
        return self.rows

    async def execute(self, sql, *params):
        self.executes.append((sql, params))
        return self.status

    async def close(self):
        pass


def _row(i):
    return {'id': str(i) * 16, 'title': 't', 'company': 'c', 'location': 'l', 'description': 'd', 'type': 'internship'}


def _result(model, description):
    return types.SimpleNamespace(
        allowed_degrees=['DEGREE'], allowed_courses=[], allowed_specializations=[], allowed_passout_years=[],
        required_skills=[], notes_highlights=None, work_mode=None, experience_min=0, experience_max=0,
        job_function=None, structured_description=description, model=model)


def _install(mod, monkeypatch, results, enabled=True):
    seen = []

    class Svc:
        def __init__(self):
            self.enabled = enabled

        async def enrich(self, **kw):
            seen.append(kw)
            return results[len(seen) - 1]
    monkeypatch.setattr(mod, 'StructuredEnrichmentService', Svc)
    return seen


def _args(**kw):
    return argparse.Namespace(**{'limit': 5, 'bulk': True, 'dry_run': False, 'no_fallback': False, **kw})


def test_no_fallback_reaches_the_service_and_no_result_writes_nothing(mod, monkeypatch):
    seen = _install(mod, monkeypatch, [None])
    pool = FakePool([_row(1)])
    out = asyncio.run(mod.enrich_structured(pool, _args(no_fallback=True)))
    assert seen[0]['allow_fallback'] is False
    assert pool.executes == [] and out['enriched'] == 0


def test_default_still_allows_fallback(mod, monkeypatch):
    seen = _install(mod, monkeypatch, [_result(mod.STRUCTURED_FALLBACK_MODEL, None)])
    asyncio.run(mod.enrich_structured(FakePool([_row(1)]), _args()))
    assert seen[0]['allow_fallback'] is True


def test_fallback_result_cannot_overwrite_an_existing_structured_description(mod, monkeypatch):
    _install(mod, monkeypatch, [_result(mod.STRUCTURED_FALLBACK_MODEL, None), _result('groq-model', 'About the Role')])
    pool = FakePool([_row(1), _row(2)])
    out = asyncio.run(mod.enrich_structured(pool, _args()))
    (fb_sql, _), (ai_sql, _) = pool.executes
    assert 'AND structured_description IS NULL' in fb_sql
    assert 'AND structured_description IS NULL' not in ai_sql
    assert (out['ai'], out['fallback']) == (1, 1)


def test_fallback_update_that_matched_no_row_is_not_counted(mod, monkeypatch):
    _install(mod, monkeypatch, [_result(mod.STRUCTURED_FALLBACK_MODEL, None)])
    out = asyncio.run(mod.enrich_structured(FakePool([_row(1)], status='UPDATE 0'), _args()))
    assert (out['enriched'], out['fallback']) == (0, 0)


def test_time_budget_stops_between_rows_and_reports_it(mod, monkeypatch):
    seen = _install(mod, monkeypatch, [_result('groq-model', 'x')] * 3)
    pool = FakePool([_row(1), _row(2), _row(3)])
    # A real deadline, spent as soon as the first row has been processed (patching time.monotonic
    # itself would also break asyncio's clock).
    args = _args(deadline=1000.0)
    clock = {'now': 0.0}
    real_sleep = mod.asyncio.sleep

    async def sleep_and_advance(_):
        clock['now'] = 5000.0
        await real_sleep(0)
    monkeypatch.setattr(mod.asyncio, 'sleep', sleep_and_advance)
    monkeypatch.setattr(mod, '_out_of_time', lambda a: clock['now'] >= a.deadline)
    out = asyncio.run(mod.enrich_structured(pool, args))
    assert len(seen) == 1 and out['enriched'] == 1 and out['stopped_early'] is True


def test_out_of_time_helper(mod):
    import time
    assert mod._out_of_time(argparse.Namespace()) is False
    assert mod._out_of_time(argparse.Namespace(deadline=None)) is False
    assert mod._out_of_time(argparse.Namespace(deadline=time.monotonic() - 1)) is True
    assert mod._out_of_time(argparse.Namespace(deadline=time.monotonic() + 3600)) is False


def test_no_deadline_means_no_limit(mod, monkeypatch):
    seen = _install(mod, monkeypatch, [_result('groq-model', 'x')] * 2)
    out = asyncio.run(mod.enrich_structured(FakePool([_row(1), _row(2)]), _args()))
    assert len(seen) == 2 and out['stopped_early'] is False


def _run_main(mod, monkeypatch, argv, pool_rows=()):
    async def fake_pool(*a, **k):
        return FakePool(list(pool_rows))
    monkeypatch.setattr(mod.asyncpg, 'create_pool', fake_pool)
    monkeypatch.setattr(sys, 'argv', ['enrich_all_content.py', *argv])
    return asyncio.run(mod.main())


def test_no_fallback_structured_without_groq_key_refuses_to_run(mod, monkeypatch):
    _install(mod, monkeypatch, [], enabled=False)
    with pytest.raises(SystemExit) as exc:
        _run_main(mod, monkeypatch, ['--target', 'structured', '--no-fallback'])
    assert exc.value.code == 2


def test_run_where_every_attempted_row_failed_exits_3(mod, monkeypatch):
    _install(mod, monkeypatch, [None, None])
    with pytest.raises(SystemExit) as exc:
        _run_main(mod, monkeypatch, ['--target', 'structured', '--no-fallback'], pool_rows=[_row(1), _row(2)])
    assert exc.value.code == 3


def test_run_with_some_successes_or_no_candidates_exits_normally(mod, monkeypatch):
    _install(mod, monkeypatch, [_result('groq-model', 'x'), None])
    _run_main(mod, monkeypatch, ['--target', 'structured', '--no-fallback'], pool_rows=[_row(1), _row(2)])
    _install(mod, monkeypatch, [])
    _run_main(mod, monkeypatch, ['--target', 'structured', '--no-fallback'], pool_rows=[])


def _default(text, name):
    m = re.search(rf"inputs\.{name} \|\| '(\d+)'", text)
    assert m, f'{name} default not found'
    return int(m.group(1))


@pytest.mark.parametrize('name', ['phase-b-structured-backfill.yml', 'job-content-enrichment.yml'])
def test_groq_workflows_have_a_runtime_budget_that_fits_the_command_timeout(name):
    text = (WORKFLOWS / name).read_text()
    assert '--no-fallback' in text and '--max-runtime-minutes' in text
    budget = _default(text, 'max_minutes')
    timeout = int(re.search(r'command_timeout:\s*(\d+)m', text).group(1))
    assert timeout >= budget + 10, 'leave room for the row in flight (Groq 429 backoff) and startup'


def test_no_workflow_comment_points_at_the_deleted_workflow_as_if_it_exists():
    assert not (WORKFLOWS / 'content-enrichment.yml').exists()
    for f in WORKFLOWS.glob('*.yml'):
        for line in f.read_text().splitlines():
            if re.search(r'(?<![-\w])content-enrichment\.yml', line):
                # only the replacement workflow may mention it, and only as history
                assert f.name == 'job-content-enrichment.yml' and ('Replaces' in line or 'used' in line), (f.name, line)
