"""enrich_all_content.py --target companies: fact-only profiles (no LLM).

DB access is faked here; the same SQL was also run against a real Postgres 16
with migrations 019 + 023 when this was written (see REPO_AUDIT_2026-09-20.md,
Session 3): case-variant merge, stale-row refresh, thin companies stored without
an overview, expired/inactive/blank companies skipped, idempotent second run.
"""
import argparse
import asyncio
import importlib
import json
import pathlib
import sys
import types
from datetime import date, datetime

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
    """Answers each query by identity so the test reads like the data flow."""

    def __init__(self, mod, candidates, base, **grouped):
        q = mod.company_fact_queries()
        self.by_sql = {mod.company_candidates_sql(): candidates, q['base']: base}
        for name, rows in grouped.items():
            self.by_sql[q[name]] = rows
        self.fetches, self.executes = [], []

    async def fetch(self, sql, *params):
        self.fetches.append((sql, params))
        return self.by_sql.get(sql, [])

    async def execute(self, sql, *params):
        self.executes.append((sql, params))


def _args(**kw):
    return argparse.Namespace(**{'limit': 50, 'dry_run': False, **kw})


CANDS = [{'company': 'Acme', 'ckey': 'acme'}, {'company': 'Beta Corp', 'ckey': 'beta corp'}]
BASE = [
    {'ckey': 'acme', 'active_listings': 3, 'internships': 1, 'remote_listings': 0, 'fresher_listings': 1,
     'experience_min': 0, 'experience_max': 2, 'stipend_listings': 0, 'salary_listings': 0, 'official_domain': None,
     'first_listed': datetime(2026, 9, 17), 'latest_posted': datetime(2026, 9, 19)},
    {'ckey': 'beta corp', 'active_listings': 1, 'internships': 1, 'remote_listings': 0, 'fresher_listings': 0,
     'experience_min': None, 'experience_max': None, 'stipend_listings': 0, 'salary_listings': 0, 'official_domain': None,
     'first_listed': datetime(2026, 9, 20), 'latest_posted': datetime(2026, 9, 20)},
]
GROUPED = dict(
    locations=[{'ckey': 'acme', 'v': 'Pune', 'n': 2}, {'ckey': 'acme', 'v': 'Remote', 'n': 1}, {'ckey': 'beta corp', 'v': 'Delhi', 'n': 1}],
    skills=[{'ckey': 'acme', 'v': 'Python', 'n': 2}],
)


def test_scope_is_the_same_freshness_definition_the_companies_page_uses(mod):
    from routes.jobs import _freshness_conditions
    for sql in [mod.company_candidates_sql(), *mod.company_fact_queries().values()]:
        assert 'is_active = true' in sql
        for cond in _freshness_conditions():
            assert cond in sql


def test_candidate_query_is_ordered_bounded_case_insensitive_and_refreshes_stale(mod):
    sql = mod.company_candidates_sql()
    assert 'ORDER BY count(DISTINCT j.id) DESC' in sql and 'LIMIT $1' in sql
    assert 'lower(cp.company) = lower(j.company)' in sql and 'GROUP BY lower(j.company)' in sql
    assert 'cp.company IS NULL' in sql and 'cp.enriched_at < now() - make_interval(hours => $2)' in sql


def test_writes_facts_overview_and_clears_speculative_columns(mod):
    pool = FakePool(mod, CANDS, BASE, **GROUPED)
    out = asyncio.run(mod.enrich_companies(pool, _args(), today=date(2026, 9, 20)))
    assert out == {'attempted': 2, 'enriched': 2, 'with_overview': 1}
    upserts = [p for s, p in pool.executes if s == mod.COMPANY_UPSERT_SQL]
    acme = next(p for p in upserts if p[0] == 'Acme')
    assert acme[1].startswith('As of 20 Sep 2026, Acme has 3 active listings')
    assert 'Pune (2)' in acme[1] and 'Python (2)' in acme[1]
    assert json.loads(acme[3])['active_listings'] == 3      # jsonb gets a JSON string
    assert acme[4] == mod.FACTS_MODEL
    assert 'culture_summary = NULL' in mod.COMPANY_UPSERT_SQL and 'review_snippets = NULL' in mod.COMPANY_UPSERT_SQL
    assert pool.fetches[0][1] == (50, mod.COMPANY_REFRESH_HOURS)


def test_thin_company_is_stored_without_overview_so_it_is_not_reprocessed(mod):
    pool = FakePool(mod, CANDS, BASE, **GROUPED)
    asyncio.run(mod.enrich_companies(pool, _args(), today=date(2026, 9, 20)))
    beta = next(p for s, p in pool.executes if s == mod.COMPANY_UPSERT_SQL and p[0] == 'Beta Corp')
    assert beta[1] is None and beta[2] == []
    assert json.loads(beta[3])['locations'] == [{'name': 'Delhi', 'count': 1}]


def test_different_case_rows_are_removed_before_upsert(mod):
    pool = FakePool(mod, CANDS[:1], BASE[:1], **GROUPED)
    asyncio.run(mod.enrich_companies(pool, _args()))
    assert pool.executes[0] == (mod.COMPANY_DEDUPE_SQL, ('Acme',))
    assert 'company <> $1' in mod.COMPANY_DEDUPE_SQL


def test_company_that_expired_between_queries_is_skipped(mod):
    pool = FakePool(mod, CANDS, BASE[:1], **GROUPED)
    out = asyncio.run(mod.enrich_companies(pool, _args()))
    assert out['enriched'] == 1


def test_dry_run_does_not_write(mod):
    pool = FakePool(mod, CANDS, BASE, **GROUPED)
    out = asyncio.run(mod.enrich_companies(pool, _args(dry_run=True)))
    assert out['enriched'] == 2 and pool.executes == []


def test_companies_target_makes_no_llm_calls_and_is_not_part_of_all(mod):
    src = (SCRIPTS / 'enrich_all_content.py').read_text()
    assert "choices=['jobs', 'structured', 'companies', 'translations', 'all']" in src
    assert "args.target == 'companies'" in src
    assert 'CompanyEnrichmentService' not in src and 'company_enrichment_service' not in src
    assert not (SRC / 'services' / 'company_enrichment_service.py').exists()
