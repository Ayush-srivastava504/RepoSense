# Pins the rules that keep job articles honest and unique: invented numbers are cut, short or duplicated
# articles are never stored, and a real article passes with its word count.
from services.job_article_service import (
    MIN_WORDS, SECTION_PLAN, ShingleCorpus, build_source_text, stored_article_text, validate_article,
)

JOB = {
    'title': 'Data Analyst Intern', 'company': 'Razorpay', 'location': 'Bengaluru', 'type': 'internship',
    'required_skills': ['SQL', 'Python', 'Excel'], 'allowed_passout_years': [2026],
    'description': 'Work with the payments analytics team on SQL dashboards.',
}
SRC = build_source_text(JOB)


def _para(key: str, i: int) -> str:
    # Distinct wording per section/paragraph so the shingle checks see real variety.
    return (f'In the {key} part number word {i} the {JOB["title"]} reader learns how {key} work at Razorpay connects to '
            f'payments analytics, why careful SQL habits matter for paragraph {key} {i}, and how a student can show '
            f'that habit with a small project built around {key} questions for entry {i} of this guide. '
            f'Keep notes on what you tried for {key} {i}, what failed, and what you would change before an interview.')


def _article(extra_sentence: str = '') -> dict:
    words = iter(['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'])
    sections = {key: [_para(key, n) for n in ('one', 'two', 'three', 'four')] for key, _, _ in SECTION_PLAN}
    sections['overview'][0] += extra_sentence
    faqs = [{'q': f'Can a {w} applicant in the 2026 batch apply for this role?',
             'a': f'The listing names the 2026 batch, so {w} applicants from that batch fit. Confirm details on the careers page before applying today.'}
            for w, _ in zip(words, range(8))]
    return {'sections': sections, 'faqs': faqs}


def _words_ok():
    out = validate_article(_article(), SRC)
    assert out is not None
    return out


def test_good_article_passes_with_word_count():
    out = _words_ok()
    assert out['words'] >= MIN_WORDS
    assert [s['key'] for s in out['sections']] == [k for k, _, _ in SECTION_PLAN]


def test_sentence_with_invented_number_is_removed():
    out = validate_article(_article(' The stipend is 45000 per month.'), SRC)
    assert out is not None
    assert '45000' not in stored_article_text(out)


def test_numbers_from_the_listing_are_kept():
    assert '2026' in stored_article_text(_words_ok())


def test_short_article_is_rejected():
    art = _article()
    art['sections'] = {k: v[:1] for k, v in art['sections'].items()}
    assert validate_article(art, SRC) is None


def test_duplicate_of_published_article_is_rejected():
    corpus = ShingleCorpus()
    corpus.add(stored_article_text(_words_ok()))
    assert validate_article(_article(), SRC, corpus) is None


def test_copy_of_scraped_description_is_rejected():
    long_desc = ' '.join(_para(k, 'x') for k, _, _ in SECTION_PLAN) * 3
    src = build_source_text({**JOB, 'description': long_desc})
    art = {'sections': {k: [_para(k, 'x')] * 4 for k, _, _ in SECTION_PLAN}, 'faqs': _article()['faqs']}
    assert validate_article(art, src) is None


def test_marketing_fluff_sentence_is_removed():
    out = validate_article(_article(' This is an exciting, fast-paced dream job.'), SRC)
    assert out is not None and 'exciting' not in stored_article_text(out)
