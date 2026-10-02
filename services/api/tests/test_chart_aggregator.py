#
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'crawler' / 'src'))

from processors.content_layer import segment_key as crawler_segment_key
from services import chart_aggregator as ca


def job(i, title='Machine Learning Engineer', **kw):
    d = dict(id=f'j{i}', title=title, type='full-time', location='Bengaluru, IN', is_remote=False, segment_key=None,
             work_mode=None, experience_min=None, required_skills=None, enriched_keywords=None, description='')
    d.update(kw)
    return d


def test_segment_key_fallback_matches_crawler():
    for j in [job(1), job(2, location='Remote - India'), job(3, title='', location=''), job(4, type='internship', title='Data Analyst', location='Pune, IN')]:
        assert ca.segment_key_for(j) == crawler_segment_key(j)


def test_stored_segment_key_wins():
    assert ca.segment_key_for(job(1, segment_key='x:y:z')) == 'x:y:z'


def test_experience_buckets():
    assert [ca.experience_bucket(v) for v in (None, 0, 1, 2, 3, 5, 6, 12)] == [
        None, '0 Years', '1-2 Years', '1-2 Years', '3-5 Years', '3-5 Years', '6+ Years', '6+ Years']


def test_skill_percentages_and_denominators():
    jobs = [job(i, description='Python and SQL, deploy on AWS with Docker', experience_min=0 if i < 6 else None) for i in range(10)]
    jobs += [job(100 + i, description='PyTorch, Kubernetes', experience_min=4) for i in range(10)]
    out = ca.finalize(ca.aggregate(jobs), min_sample=5)
    t = out['topic:machine-learning-engineer']
    assert t['sample_size'] == 20
    s = t['stats']
    assert s['skills_pct']['Python'] == 50.0 and s['skills_pct']['PyTorch'] == 50.0 and s['skills_pct']['Cloud'] == 50.0
    assert s['experience_known'] == 16                       # 6 at 0 yrs + 10 at 4 yrs; 4 unknown excluded from the denominator
    assert s['experience_pct']['0 Years'] == round(100 * 6 / 16, 1)
    assert s['experience_pct']['3-5 Years'] == round(100 * 10 / 16, 1)


def test_small_samples_are_not_published():
    out = ca.finalize(ca.aggregate([job(i) for i in range(ca.MIN_SAMPLE - 1)]))
    assert out == {}
    out = ca.finalize(ca.aggregate([job(i) for i in range(ca.MIN_SAMPLE)]))
    assert 'topic:machine-learning-engineer' in out and any(k.startswith('segment:') for k in out)


def test_topic_only_matches_title():
    out = ca.finalize(ca.aggregate([job(i, title='Backend Developer', description='machine learning') for i in range(30)]))
    assert 'topic:machine-learning-engineer' not in out


def test_work_mode_and_locations():
    jobs = [job(i, work_mode='Hybrid') for i in range(10)] + [job(20 + i, location='Remote') for i in range(10)] + [job(40 + i) for i in range(5)]
    s = ca.finalize(ca.aggregate(jobs), min_sample=5)['topic:machine-learning-engineer']['stats']
    assert s['work_mode_known'] == 20 and s['work_mode_pct'] == {'Hybrid': 50.0, 'Remote': 50.0}
    assert s['top_locations'][0]['name'] == 'Bengaluru'
