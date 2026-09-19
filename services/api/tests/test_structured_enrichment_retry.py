"""Groq 429/5xx handling in StructuredEnrichmentService.

A 429 used to fall straight through to the rule-based fallback (saving a
degraded row with no structured_description). It must now wait (honoring
retry-after), retry, and only fall back once retries are exhausted.
"""
import asyncio
import importlib
import pathlib
import sys
import types

import httpx
import pytest

SRC = pathlib.Path(__file__).resolve().parents[1] / 'src'


@pytest.fixture
def svc(monkeypatch):
    monkeypatch.syspath_prepend(str(SRC))
    # Stub settings so the test needs no real env/config.
    pkg, mod = types.ModuleType('configs'), types.ModuleType('configs.config')
    mod.settings = types.SimpleNamespace(GROQ_API_KEY='test-key')
    monkeypatch.setitem(sys.modules, 'configs', pkg)
    monkeypatch.setitem(sys.modules, 'configs.config', mod)
    sys.modules.pop('services.structured_enrichment_service', None)
    module = importlib.import_module('services.structured_enrichment_service')

    async def no_sleep(_):  # keep tests instant
        return None
    monkeypatch.setattr(module.asyncio, 'sleep', no_sleep)
    return module


def _install_transport(monkeypatch, module, handler):
    real = httpx.AsyncClient

    class Client(real):
        def __init__(self, *a, **k):
            super().__init__(*a, transport=httpx.MockTransport(handler), **k)
    monkeypatch.setattr(module.httpx, 'AsyncClient', Client)


OK_BODY = {'choices': [{'message': {'content': '{"allowed_degrees":["DEGREE"],"structured_description":"About the Role\\nx"}'}}]}


def test_recovers_after_429s_and_uses_ai_result(svc, monkeypatch):
    calls = {'n': 0}

    def handler(request):
        calls['n'] += 1
        if calls['n'] <= 2:
            return httpx.Response(429, headers={'retry-after': '1'})
        return httpx.Response(200, json=OK_BODY)

    _install_transport(monkeypatch, svc, handler)
    result = asyncio.run(svc.StructuredEnrichmentService('k').enrich(title='t', company='c'))
    assert calls['n'] == 3
    assert result.model == svc.GROQ_MODEL
    assert result.structured_description


def test_falls_back_only_after_retries_exhausted(svc, monkeypatch):
    calls = {'n': 0}

    def handler(request):
        calls['n'] += 1
        return httpx.Response(429)

    _install_transport(monkeypatch, svc, handler)
    result = asyncio.run(svc.StructuredEnrichmentService('k').enrich(title='t', company='c'))
    assert calls['n'] == svc.MAX_RETRIES + 1
    assert result.model == svc.FALLBACK_MODEL


def test_allow_fallback_false_returns_none_after_retries(svc, monkeypatch):
    _install_transport(monkeypatch, svc, lambda r: httpx.Response(429))
    result = asyncio.run(svc.StructuredEnrichmentService('k').enrich(title='t', company='c', allow_fallback=False))
    assert result is None


def test_non_retryable_4xx_is_not_retried(svc, monkeypatch):
    calls = {'n': 0}

    def handler(request):
        calls['n'] += 1
        return httpx.Response(401)

    _install_transport(monkeypatch, svc, handler)
    result = asyncio.run(svc.StructuredEnrichmentService('k').enrich(title='t', company='c'))
    assert calls['n'] == 1
    assert result.model == svc.FALLBACK_MODEL


def test_retry_after_header_is_honored_and_capped(svc):
    r = httpx.Response(429, headers={'retry-after': '7'})
    assert 7 <= svc._retry_delay(r, 0) <= 7 + 2.0
    big = httpx.Response(429, headers={'retry-after': '9999'})
    assert svc._retry_delay(big, 0) <= svc.BACKOFF_MAX_S + 2.0
    none = httpx.Response(429)
    assert svc._retry_delay(none, 2) >= svc.BACKOFF_BASE_S * 4
