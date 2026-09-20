"""Guards against enrich_structured()'s default (non --force-stale) query
losing its ORDER BY again. That path is what phase-b-structured-backfill.yml
actually runs daily; without an explicit order Postgres returns rows in
arbitrary physical order, silently undoing "new jobs enriched first" for the
structured-field backfill even though the overview/keyword enrichment path
(enrich_job_content.py, enrich_jobs() here) has always ordered correctly.
"""
import pathlib
import re

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / 'scripts' / 'enrich_all_content.py'


def _default_structured_query() -> str:
    source = SCRIPT.read_text()
    match = re.search(
        r'query = "SELECT id, title, company, location, description, type FROM jobs '
        r'WHERE is_active = true AND structured_description IS NULL[^"]*"',
        source,
    )
    assert match, 'default enrich_structured() query not found -- did the SQL text change shape?'
    return match.group(0)


def test_default_structured_query_orders_by_posted_at_desc_nulls_last():
    query = _default_structured_query()
    assert 'ORDER BY posted_at DESC NULLS LAST' in query, (
        'structured backfill must process newest jobs first, same as enrich_jobs()'
    )


def test_default_structured_query_still_scoped_to_active_unstructured_rows():
    query = _default_structured_query()
    assert 'is_active = true' in query
    assert 'structured_description IS NULL' in query
