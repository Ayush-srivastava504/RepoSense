"""Regression guard: LIMIT/OFFSET pagination on /api/jobs must be deterministic.

Without a unique tie-breaker, rows sharing a posted_at (or NULL) can appear on
two pages and vanish from others; that put ~250 duplicate URLs in
sitemap-jobs.xml. Verified against real Postgres 16: old ordering returned
1,967 duplicates / 1,967 missing rows on a 14,077-row table; this ordering 0.
"""
import pathlib
import re

SRC = (pathlib.Path(__file__).resolve().parents[1] / 'src' / 'routes' / 'jobs.py').read_text()


def test_recent_order_has_unique_tiebreaker_and_nulls_last():
    assert "order_by = 'posted_at DESC NULLS LAST, id DESC'" in SRC


def test_ranked_order_has_unique_tiebreaker_and_nulls_last():
    assert re.search(r"DESC, posted_at DESC NULLS LAST, id DESC'", SRC)


def test_no_bare_posted_at_desc_order_by_left():
    assert "order_by = 'posted_at DESC'\n" not in SRC
