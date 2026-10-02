import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

from services.job_sections_service import build_source_text, has_enough_source, validate_sections  # noqa: E402

JOB = {'title': 'Application Security Engineer', 'company': 'Acme', 'location': 'Hyderabad', 'type': 'job',
       'salary': '12-22 LPA', 'required_skills': ['SAST', 'DAST', 'Checkmarx'], 'experience_min': 3, 'experience_max': 5,
       'description': 'Run security reviews with Checkmarx and Burp Suite. ' * 8}
SRC = build_source_text(JOB)


def good():
    return {
        'responsibilities': ['Run security reviews of web applications using Checkmarx.', 'Validate fixes with Burp Suite after each release.',
                             'Report findings to the development team with remediation steps.'],
        'prep_tips': ['Practice explaining a SAST finding and how you triaged it.'],
        'common_mistakes': ['Listing tools without a project that used them; add one result per tool.'],
        'ats_keywords': ['Checkmarx', 'Burp Suite', 'Kubernetes'],
        'faqs': [{'q': f'What does question {i} cover for this role?', 'a': 'The listing asks for 3-5 years of experience with Checkmarx.'} for i in range(3)],
    }


def test_valid_output_kept_and_ungrounded_keyword_dropped():
    out = validate_sections(good(), SRC)
    assert out and len(out['responsibilities']) == 3 and len(out['faqs']) == 3
    assert 'Kubernetes' not in out['ats_keywords'] and 'Checkmarx' in out['ats_keywords']


def test_invented_number_fluff_and_emoji_items_are_dropped():
    g = good()
    g['responsibilities'] += ['Lead a team of 40 engineers across the region.', 'Join an exciting and dynamic security team.', 'Handle incident response 🚨 for clients.']
    out = validate_sections(g, SRC)
    assert len(out['responsibilities']) == 3


def test_too_little_grounded_content_returns_none_and_thin_source_is_skipped():
    assert validate_sections({'responsibilities': ['Short.'], 'faqs': []}, SRC) is None
    assert validate_sections('not a dict', SRC) is None
    assert has_enough_source(JOB) and not has_enough_source({'description': 'Too short.'})
