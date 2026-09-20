"""company_facts_service: fact-only company profiles (pure functions)."""
import importlib
import pathlib
import sys
from datetime import date, datetime

import pytest

SRC = pathlib.Path(__file__).resolve().parents[1] / 'src'


@pytest.fixture
def facts_mod(monkeypatch):
    monkeypatch.syspath_prepend(str(SRC))
    return importlib.import_module('services.company_facts_service')


BASE = {
    'active_listings': 3, 'internships': 1, 'remote_listings': 1, 'fresher_listings': 2,
    'experience_min': 0, 'experience_max': 4, 'stipend_listings': 1, 'salary_listings': 1,
    'official_domain': 'acme.com',
    'first_listed': datetime(2026, 9, 17, 8, 0), 'latest_posted': datetime(2026, 9, 19, 8, 0),
}
TODAY = date(2026, 9, 20)


def _rich(m):
    return m.build_facts(
        BASE,
        locations=[('Pune', 2), ('Remote', 1)],
        work_modes=[('HYBRID', 1), ('ONSITE', 1), ('REMOTE', 1)],
        functions=[('Software Development', 2), ('Data & Analytics', 1)],
        skills=[('Python', 1), ('python', 1), ('SQL', 1)],
        courses=[('B.Tech', 2)],
        as_of=TODAY,
    )


def test_top_counts_merges_case_and_whitespace_and_prefers_capitalised_on_ties(facts_mod):
    out = facts_mod.top_counts([('Pune ', 1), ('pune', 1), ('Delhi', 1), ('', 5), (None, 2)], 5)
    assert out[0] == {'name': 'Pune', 'count': 2}
    assert {'name': 'Delhi', 'count': 1} in out and len(out) == 2
    skills = facts_mod.top_counts([('Python', 1), ('python', 1)], 5)
    assert skills == [{'name': 'Python', 'count': 2}]


def test_top_counts_respects_limit_and_orders_by_count(facts_mod):
    out = facts_mod.top_counts([('a', 1), ('b', 3), ('c', 2)], 2)
    assert [o['name'] for o in out] == ['b', 'c']


def test_build_facts_counts_and_dates(facts_mod):
    f = _rich(facts_mod)
    assert (f['active_listings'], f['internships'], f['jobs']) == (3, 1, 2)
    assert f['first_listed'] == '2026-09-17' and f['latest_posted'] == '2026-09-19'
    assert f['work_modes'] == {'HYBRID': 1, 'ONSITE': 1, 'REMOTE': 1}
    assert f['experience'] == {'min': 0, 'max': 4, 'fresher_listings': 2}


def test_unknown_work_modes_are_dropped(facts_mod):
    f = facts_mod.build_facts(BASE, work_modes=[('WHATEVER', 3), ('remote', 1)], as_of=TODAY)
    assert f['work_modes'] == {'REMOTE': 1}


def test_overview_states_only_what_the_facts_say(facts_mod):
    text = facts_mod.render_overview('Acme', _rich(facts_mod))
    assert text.startswith('As of 20 Sep 2026, Acme has 3 active listings on InternFlow: 1 internship and 2 jobs.')
    for expected in ('Locations listed: Pune (2), Remote (1).',
                     'Work mode where stated: 1 hybrid, 1 on-site, 1 remote.',
                     'Software Development (2), Data & Analytics (1)',
                     'Python (2), SQL (1)',
                     'Courses listed as eligible: B.Tech (2).',
                     'Experience required ranges from 0 to 4 years; 2 listings are open to freshers (0 years).',
                     '1 listing states a stipend and 1 listing states a salary.',
                     'acme.com',
                     'most recent listing was posted on 19 Sep 2026'):
        assert expected in text
    # nothing speculative: no culture / reputation / size language
    for banned in ('culture', 'reviews', 'reputation', 'leading', 'founded', 'employees', 'rated'):
        assert banned not in text.lower()


def test_absent_data_produces_no_sentence(facts_mod):
    base = {'active_listings': 2, 'internships': 0}
    f = facts_mod.build_facts(base, locations=[('Pune', 2)], skills=[('Excel', 2)], as_of=TODAY)
    text = facts_mod.render_overview('Gamma', f)
    assert 'Work mode' not in text and 'Experience' not in text and 'stipend' not in text and 'Courses' not in text
    assert 'Locations listed: Pune (2).' in text and 'Excel (2)' in text


def test_too_few_facts_gives_no_overview(facts_mod):
    only_location = facts_mod.build_facts({'active_listings': 1, 'internships': 1, 'latest_posted': datetime(2026, 9, 20)},
                                          locations=[('Delhi', 1)], as_of=TODAY)
    assert facts_mod.render_overview('Beta', only_location) is None
    nothing = facts_mod.build_facts({'active_listings': 1, 'internships': 0}, as_of=TODAY)
    assert facts_mod.render_overview('Beta', nothing) is None


def test_singular_grammar(facts_mod):
    f = facts_mod.build_facts({'active_listings': 1, 'internships': 0, 'stipend_listings': 1, 'fresher_listings': 1,
                               'experience_min': 0, 'experience_max': 0, 'remote_listings': 1},
                              locations=[('Pune', 1)], as_of=TODAY)
    text = facts_mod.render_overview('Solo', f)
    assert '1 active job listing on InternFlow.' in text
    assert '1 listing is open to freshers' in text and '1 listing states a stipend' in text
    assert '1 listing is marked remote.' in text


def test_keywords_come_only_from_the_facts(facts_mod):
    kw = facts_mod.build_keywords('Acme', _rich(facts_mod))
    assert kw[0] == 'acme' and 'python' in kw and 'internship' in kw and 'pune' in kw
    assert len(kw) <= facts_mod.MAX_KEYWORDS and len(set(kw)) == len(kw)
