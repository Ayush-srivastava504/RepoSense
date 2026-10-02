import sys
from pathlib import Path

import logging
import types

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'crawler' / 'src'))
# crawler utils pulls in boto3/psycopg2; the gate only needs get_logger, so stub it
# to keep this test hermetic (no AWS/DB deps in the unit-test environment).
_stub = types.ModuleType('utils')
_stub.get_logger = logging.getLogger
sys.modules.setdefault('utils', _stub)

from processors.quality import (assess_government_legitimacy, classify_government_relevance,
                                filter_and_score, GENERAL_GOV_QUALITY_CAP)
from processors.content_layer import attach_content_plan


def gov(**kw):
    d = dict(title='Junior Engineer (Electrical)', company='BHEL', department='BHEL', vacancies='120',
             notification_number='Advt 04/2026', deadline='2026-10-30', description='Short row.',
             apply_url='https://www.freejobalert.com/articles/bhel-je-2026/', is_government=True, source='freejobalert')
    d.update(kw)
    return d


def test_relevance_split():
    assert classify_government_relevance(gov()) == 'tech_psu'
    assert classify_government_relevance(gov(title='Management Trainee', department='NTPC', company='NTPC')) == 'tech_psu'
    assert classify_government_relevance(gov(title='Clerk', department='BHEL')) == 'general'
    assert classify_government_relevance(gov(title='Constable', department='SSC', company='SSC')) == 'general'


def test_complete_notice_no_longer_thin_or_uncertain():
    v = assess_government_legitimacy(gov())
    assert v['state'] == 'likely' and v['is_thin'] is False and v['quality_score'] == 80


def test_official_domain_tech_notice_verified_and_full():
    kept, rej = filter_and_score([gov(apply_url='https://bhel.gov.in/notice/je-2026')])
    assert not rej and kept[0]['legitimacy_state'] == 'verified'
    assert attach_content_plan(kept[0])['content_tier'] == 'full'


def test_general_notice_capped_and_never_full():
    j = gov(title='Constable', department='State Police', company='State Police',
            apply_url='https://police.gov.in/n/1')
    kept, _ = filter_and_score([j])
    assert kept[0]['legitimacy_state'] == 'likely'
    assert kept[0]['quality_score'] <= GENERAL_GOV_QUALITY_CAP
    assert attach_content_plan(kept[0])['content_tier'] == 'standard'


def test_bare_notice_stays_uncertain_and_thin():
    j = gov(department=None, company='Government Recruitment', vacancies=None, notification_number=None, deadline=None)
    v = assess_government_legitimacy(j)
    assert v['state'] == 'uncertain' and v['is_thin'] is True


def test_company_jobs_unchanged_and_still_rejected_on_govt_domain():
    kept, rej = filter_and_score([dict(title='SDE', company='Acme', apply_url='https://x.gov.in/p/1', description='x' * 400)])
    assert rej and rej[0]['_rejection_reason'] == 'govt portal domain'
