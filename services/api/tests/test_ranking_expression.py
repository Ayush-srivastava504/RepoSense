# The ranked ordering must keep a listing older than 30 days below EVERY listing from the last 30 days, whatever the
# company or confidence. Verified on Postgres 16 with the screenshot case (63-day-old top-company internship ranked
# 8th of 8 after the fix, 2nd before it); this pins the arithmetic so the penalties cannot be quietly weakened.
import ast
import re
from pathlib import Path

# read the constant from source (like the other route tests) so the test needs no FastAPI install
_SRC = (Path(__file__).resolve().parents[1] / 'src' / 'routes' / 'jobs.py').read_text()
RANKING_EXPRESSION = ast.literal_eval(re.search(r'^RANKING_EXPRESSION = (".*")$', _SRC, re.M).group(1))

TOP_COMPANY_BONUS = 40
MAX_CONFIDENCE = 25


def _penalties():
    return {
        'old_30_60': int(re.search(r"interval '60 days' THEN (-\d+)", RANKING_EXPRESSION).group(1)),
        'older_60': int(re.search(r"ELSE (-\d+)\s+END", RANKING_EXPRESSION).group(1)),
    }


def test_best_possible_old_listing_scores_below_worst_fresh_listing():
    p = _penalties()
    best_old = TOP_COMPANY_BONUS + MAX_CONFIDENCE + max(p.values())
    worst_fresh = 0  # non-top company, 7-30 days old, confidence 0
    assert best_old < worst_fresh, best_old


def test_open_deadline_and_unknown_date_keep_the_gentle_penalty():
    assert "deadline IS NOT NULL AND deadline > now() THEN -25" in RANKING_EXPRESSION
    assert "COALESCE(posted_at, created_at) IS NULL THEN -25" in RANKING_EXPRESSION
    # and they are checked BEFORE the harsh stale penalties
    assert RANKING_EXPRESSION.index('deadline > now() THEN -25') < RANKING_EXPRESSION.index("interval '60 days'")
