"""Crawler-side enrichment: rate limits must be retried / rotated, and a failed AI call must
leave the row untouched (no template / rule-based row written)."""
import importlib
import pathlib
import sys
import types

import pytest
import requests

CRAWLER_SRC = pathlib.Path(__file__).resolve().parents[1] / 'crawler' / 'src'

GOOD_OVERVIEW = '{"overview": "%s", "keywords": ["a", "b"]}' % ' '.join(['word'] * 80)
GOOD_STRUCT = '{"allowed_degrees": ["DEGREE"], "structured_description": "About the Role\\nx"}'


class Resp:
    def __init__(self, status=200, content=None, headers=None, text=''):
        self.status_code = status
        self.headers = headers or {}
        self.text = text
        self._content = content

    def json(self):
        return {'choices': [{'message': {'content': self._content}}]}


@pytest.fixture
def mods(monkeypatch):
    monkeypatch.syspath_prepend(str(CRAWLER_SRC))
    writes = []
    fake_utils = types.ModuleType('utils')
    fake_utils.get_logger = lambda name: __import__('logging').getLogger(name)

    class Cur:
        def execute(self, sql, params):
            writes.append(params)

        def close(self):
            pass

    class Conn:
        def cursor(self):
            return Cur()

        def commit(self):
            pass

    fake_utils.get_pg_conn = lambda: Conn()
    monkeypatch.setitem(sys.modules, 'utils', fake_utils)
    for name in ('llm_client', 'content_enrichment', 'structured_enrichment'):
        sys.modules.pop(name, None)
    llm = importlib.import_module('llm_client')
    monkeypatch.setattr(llm, '_sleep', lambda s: None)
    monkeypatch.setenv('GROQ_RPM', '0')
    monkeypatch.setenv('GEMINI_RPM', '0')
    ce = importlib.import_module('content_enrichment')
    se = importlib.import_module('structured_enrichment')
    return types.SimpleNamespace(llm=llm, ce=ce, se=se, writes=writes)


def _client(m, *names):
    provs = [m.llm.Provider(n, f'https://{n}.test', 'k', m.llm.DEFAULT_MODELS[n]) for n in names]
    return m.llm.LLMClient(provs)


def _post(monkeypatch, m, handler):
    calls = []

    def post(url, **kw):
        calls.append((url, kw['json']['model']))
        return handler(url, kw['json']['model'], len(calls))

    monkeypatch.setattr(m.llm.requests, 'post', post)
    return calls


def test_429_rotates_to_next_provider_and_puts_first_on_cooldown(mods, monkeypatch):
    def handler(url, model, n):
        return Resp(429, headers={'retry-after': '30'}) if 'groq' in url else Resp(200, 'ok')

    calls = _post(monkeypatch, mods, handler)
    c = _client(mods, 'groq', 'gemini')
    assert c.complete('s', 'u') == 'ok'
    assert not c._health['groq'].available()
    assert not c.exhausted
    n = len(calls)
    assert c.complete('s', 'u') == 'ok'            # groq is skipped while cooling down
    assert all('groq' not in u for u, _ in calls[n:])


def test_short_429_on_only_provider_waits_then_succeeds(mods, monkeypatch):
    slept = []
    clock = {'t': 1000.0}
    monkeypatch.setattr(mods.llm, '_now', lambda: clock['t'])

    def fake_sleep(s):  # advance the fake clock so the cooldown really expires
        slept.append(s)
        clock['t'] += s

    monkeypatch.setattr(mods.llm, '_sleep', fake_sleep)
    state = {'n': 0}

    def handler(url, model, n):
        state['n'] += 1
        return Resp(429, headers={'retry-after': '5'}) if state['n'] == 1 else Resp(200, 'ok')

    _post(monkeypatch, mods, handler)
    c = _client(mods, 'groq')
    assert c.complete('s', 'u') == 'ok'
    assert slept and slept[0] >= 4


def test_long_429_marks_exhausted_instead_of_waiting(mods, monkeypatch):
    _post(monkeypatch, mods, lambda *a: Resp(429, headers={'retry-after': '7200'}))
    c = _client(mods, 'groq', 'gemini')
    assert c.complete('s', 'u') is None
    assert c.exhausted


def test_retired_model_walks_to_next_and_bad_key_kills_provider(mods, monkeypatch):
    def handler(url, model, n):
        if 'gemini' in url and model == 'gemini-3.1-flash-lite':
            return Resp(404)
        if 'groq' in url:
            return Resp(401)
        return Resp(200, 'ok')

    calls = _post(monkeypatch, mods, handler)
    c = _client(mods, 'groq', 'gemini')
    assert c.complete('s', 'u') == 'ok'
    assert c._health['groq'].dead
    assert c.last_model == 'gemini-3-flash-preview'
    c.complete('s', 'u')
    assert calls.count(('https://gemini.test', 'gemini-3.1-flash-lite')) == 1  # retired once, never retried


def test_network_error_backs_off_and_next_provider_answers(mods, monkeypatch):
    def handler(url, model, n):
        if 'groq' in url:
            raise requests.ConnectionError('boom')
        return Resp(200, 'ok')

    _post(monkeypatch, mods, handler)
    assert _client(mods, 'groq', 'gemini').complete('s', 'u') == 'ok'


JOB = {'id': 'j1', 'title': 'Dev', 'company': 'Acme', 'location': 'Pune', 'description': 'short', 'type': 'internship'}


def test_content_run_writes_nothing_when_ai_fails(mods, monkeypatch):
    _post(monkeypatch, mods, lambda *a: Resp(429, headers={'retry-after': '7200'}))
    out = mods.ce.run_content_enrichment_for_new_jobs([dict(JOB), dict(JOB, id='j2')], client=_client(mods, 'groq'))
    assert mods.writes == []
    assert out['template_fallback'] == 0 and out['ai_enriched'] == 0 and out['deferred'] == 2
    assert out['attempted'] == 1  # stopped after the first row proved the provider is out


def test_content_run_writes_real_model_on_success(mods, monkeypatch):
    _post(monkeypatch, mods, lambda *a: Resp(200, GOOD_OVERVIEW))
    out = mods.ce.run_content_enrichment_for_new_jobs([dict(JOB)], client=_client(mods, 'groq'))
    assert out['ai_enriched'] == 1 and out['deferred'] == 0
    assert mods.writes[0][2] == 'openai/gpt-oss-120b'


def test_content_run_with_no_provider_defers_without_writing(mods):
    out = mods.ce.run_content_enrichment_for_new_jobs([dict(JOB)], client=mods.llm.LLMClient([]))
    assert mods.writes == [] and out['deferred'] == 1 and out['enabled'] is False


def test_structured_run_skips_write_on_failure_by_default(mods, monkeypatch):
    _post(monkeypatch, mods, lambda *a: Resp(429, headers={'retry-after': '7200'}))
    out = mods.se.run_structured_enrichment_for_jobs([dict(JOB)], client=_client(mods, 'groq'))
    assert mods.writes == [] and out['rule_based_fallback'] == 0 and out['deferred'] == 1


def test_structured_run_can_still_write_fallback_when_enabled(mods, monkeypatch):
    monkeypatch.setattr(mods.se, 'ALLOW_FALLBACK', True)
    _post(monkeypatch, mods, lambda *a: Resp(429, headers={'retry-after': '7200'}))
    out = mods.se.run_structured_enrichment_for_jobs([dict(JOB)], client=_client(mods, 'groq'))
    assert len(mods.writes) == 1 and out['rule_based_fallback'] == 1


def test_structured_run_writes_ai_result(mods, monkeypatch):
    _post(monkeypatch, mods, lambda *a: Resp(200, GOOD_STRUCT))
    out = mods.se.run_structured_enrichment_for_jobs([dict(JOB)], client=_client(mods, 'groq'))
    assert out['ai_enriched'] == 1 and len(mods.writes) == 1
