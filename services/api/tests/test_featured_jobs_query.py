# Regression test for the featured-jobs query bug: the old WHERE clause used
# a bare `posted_at > now() - interval '14 days'`, which (a) excluded every
# row with posted_at IS NULL and (b) never checked `deadline`, so an
# already-expired listing could still be "featured". Source-level assertion
# (no DB needed) that the fix -- reusing _freshness_conditions() -- is wired in.
import ast
from pathlib import Path

SRC = (Path(__file__).resolve().parents[1] / 'src' / 'routes' / 'jobs.py').read_text()


def _function_source(name: str) -> str:
    tree = ast.parse(SRC)
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == name:
            return ast.get_source_segment(SRC, node)
    raise AssertionError(f'{name} not found')


def test_featured_jobs_uses_freshness_conditions_not_bare_posted_at_window():
    body = _function_source('get_featured_jobs')
    assert '_freshness_conditions()' in body
    body_code_only = '\n'.join(line for line in body.splitlines() if not line.strip().startswith('#'))
    assert "posted_at > now() - interval '14 days'" not in body_code_only


def test_freshness_conditions_allows_null_posted_at_and_checks_deadline():
    from routes.jobs import _freshness_conditions
    conditions = ' '.join(_freshness_conditions())
    assert 'posted_at IS NULL' in conditions
    assert 'deadline' in conditions
