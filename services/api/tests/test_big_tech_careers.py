import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'crawler' / 'src'))
os.environ.setdefault('DATABASE_URL', 'postgresql://u:p@localhost/db')  # crawler utils reads it at import
pytest = __import__('pytest')
pytest.importorskip('playwright')  # scrapers.base imports playwright

from scrapers.big_tech_careers import parse_amazon_job, parse_microsoft_job  # noqa: E402


def test_amazon_entry_maps_to_job():
    job = parse_amazon_job({'title': 'SDE Intern', 'job_path': '/en/jobs/123/sde-intern',
                            'normalized_location': 'Bengaluru, Karnataka, IND',
                            'description_short': 'Build things.', 'posted_date': 'September  1, 2026'})
    assert job['company'] == 'Amazon'
    assert job['apply_url'] == 'https://www.amazon.jobs/en/jobs/123/sde-intern'
    assert job['type'] == 'internship'
    assert job['posted_date'] == '2026-09-01'
    assert parse_amazon_job({'title': 'x'}) is None  # no URL -> dropped


def test_microsoft_entry_maps_to_job():
    job = parse_microsoft_job({'name': 'Software Engineer Intern', 'positionUrl': '/careers/job/9',
                               'locations': ['Hyderabad, India'], 'postedTs': 1788220800})
    assert job['company'] == 'Microsoft'
    assert job['apply_url'] == 'https://apply.careers.microsoft.com/careers/job/9'
    assert job['posted_date'].startswith('2026-')
    assert job['type'] == 'internship'


def test_workday_helpers_and_parser():
    from datetime import datetime, timezone
    from scrapers.workday import parse_posted_on, location_may_be_india, parse_workday_job
    now = datetime(2026, 10, 3, tzinfo=timezone.utc)
    assert parse_posted_on('Posted Today', now) == '2026-10-03'
    assert parse_posted_on('Posted 5 Days Ago', now) == '2026-09-28'
    assert parse_posted_on('Posted 30+ Days Ago', now) == '2026-09-03'
    assert location_may_be_india('Bengaluru, India') and location_may_be_india('3 Locations')
    assert not location_may_be_india('Austin, Texas')
    listing = {'title': 'Associate Intern', 'externalPath': '/job/Bengaluru/Associate-Intern_R1', 'locationsText': '3 Locations'}
    kept = parse_workday_job('PwC', 'pwc.wd3.myworkdayjobs.com', 'Global_Campus_Careers', listing,
                             {'location': 'Mumbai, India', 'startDate': '2026-09-20', 'jobDescription': '<p>Hi</p>'})
    assert kept['company'] == 'PwC' and kept['posted_date'] == '2026-09-20' and kept['source'] == 'workday'
    assert kept['apply_url'] == 'https://pwc.wd3.myworkdayjobs.com/en-US/Global_Campus_Careers/job/Bengaluru/Associate-Intern_R1'
    # multi-location posting whose detail is outside India is dropped
    assert parse_workday_job('PwC', 'h', 's', listing, {'location': 'London, United Kingdom'}) is None


def test_candidates_merged_into_ats_companies():
    import config
    assert 'razorpay' in config.ATS_COMPANIES['greenhouse'] and 'stripe' in config.ATS_COMPANIES['greenhouse']
    assert 'cred' in config.ATS_COMPANIES['lever'] and 'plaid' in config.ATS_COMPANIES['lever']
    assert len(config.ATS_COMPANIES['greenhouse']) == len(set(config.ATS_COMPANIES['greenhouse']))
    from ats_candidates import display_company_name
    assert display_company_name('scaleai') == 'Scale AI' and display_company_name('some-new-co') == 'Some New Co'
