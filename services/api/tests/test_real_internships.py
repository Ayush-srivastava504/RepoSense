# /internships must hold real internships only, /jobs must not hold any, and 0-1 year roles get a bounded boost.
import ast
import importlib.util
import re
from pathlib import Path

# Loaded BY PATH under a private name: in CI PYTHONPATH=.:src, where `utils` is the src/utils package, not crawler/src/utils.py.
_spec = importlib.util.spec_from_file_location(
    'intern_text_under_test', Path(__file__).resolve().parents[1] / 'crawler' / 'src' / 'intern_text.py')
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
has_intern_word = _mod.has_intern_word

_SRC = (Path(__file__).resolve().parents[1] / 'src' / 'routes' / 'jobs.py').read_text()
_NS: dict = {}
exec(_SRC[_SRC.index('INTERN_TITLE_RE'):_SRC.index('def _type_conditions')], _NS)  # constants only, no FastAPI import
_RANKING = ast.literal_eval(re.search(r'^RANKING_EXPRESSION = (".*")$', _SRC, re.M).group(1))


def test_intern_is_a_word_not_a_substring():
    for ok in ('Software Engineering Intern', 'Summer Internship 2026', 'Interns wanted', 'intern - data'):
        assert has_intern_word(ok), ok
    for bad in ('Regional Manager - International Sales', 'Internal Audit Executive', 'Internet Marketing Executive', ''):
        assert not has_intern_word(bad), bad


def test_jobs_and_internships_are_exact_complements():
    assert _NS['NOT_INTERNSHIP_SQL'] == f"(NOT COALESCE({_NS['REAL_INTERNSHIP_SQL']}, false))"
    # NULL source/type must not drop a row from /jobs (NOT NULL is NULL): the COALESCE keeps it
    assert 'COALESCE(' in _NS['NOT_INTERNSHIP_SQL']


def test_sql_patterns_match_the_python_ones():
    py = (Path(__file__).resolve().parents[1] / 'crawler' / 'src' / 'processors' / 'normalizer.py').read_text()
    for word in ('manager', 'director', 'vice president', 'senior', 'principal', 'head of', 'team lead', 'architect'):
        assert word in _NS['SENIOR_TITLE_RE'] and word in py, word
    assert "'internshala', 'unstop'" in _NS['INTERNSHIP_PLATFORMS_SQL'] and "'internshala', 'unstop'" in py.replace('"', "'").replace("{'internshala', 'unstop'}", "'internshala', 'unstop'")


def test_fresher_boost_cannot_lift_an_old_listing_above_a_fresh_one():
    boost = int(re.search(r'THEN (\d+) ELSE 0 END', _NS['FRESHER_BOOST_EXPRESSION']).group(1))
    assert "interval '30 days'" in _NS['FRESHER_BOOST_EXPRESSION']  # gated to the fresh window
    best_old = 40 + 25 + max(-100, -150) + boost  # top company + full confidence + gentlest stale penalty
    assert best_old < 0, best_old


def test_fresher_rule_does_not_trust_the_0_0_default():
    sql = _NS['FRESHER_SQL']
    assert 'BETWEEN 1 AND 2' in sql  # explicit 0-1 / 0-2 years; the unknown default is (0, 0)
    assert 'title !~*' in sql  # never boost a senior title


def test_ranking_expression_is_untouched_by_the_boost():
    assert 'fresher' not in _RANKING.lower()
