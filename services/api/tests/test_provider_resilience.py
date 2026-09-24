import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import httpx
import services.content_enrichment_service as ces
from services.llm_providers import ProviderHTTPError

GOOD = '{"overview": "%s", "keywords": ["a", "b"]}' % ' '.join(['word'] * 80)


def _svc():
    return ces.ContentEnrichmentService(api_key='g', gemini_api_key='m', nvidia_api_key='n')


def test_retired_model_falls_through_to_next_model(monkeypatch):
    calls = []

    async def fake(provider, *, model=None, **kw):
        calls.append((provider.name, model))
        if provider.name == 'gemini' and model == 'gemini-2.5-flash':
            raise ProviderHTTPError('gemini', model, 404, None, 'no longer available')
        return GOOD

    monkeypatch.setattr(ces, 'call_chat_completion', fake)
    svc = ces.ContentEnrichmentService(gemini_api_key='m', api_key='', nvidia_api_key='')
    svc._providers = [ces.gemini_provider('m', 'gemini-2.5-flash')]
    svc._health = {'gemini': ces.ProviderHealth()}
    r = asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False))
    assert r and r.model == 'gemini-3.1-flash-lite'
    # retired model is never retried on later rows
    asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False))
    assert calls.count(('gemini', 'gemini-2.5-flash')) == 1


def test_429_puts_provider_on_cooldown(monkeypatch):
    calls = []

    async def fake(provider, *, model=None, **kw):
        calls.append(provider.name)
        if provider.name == 'groq':
            raise ProviderHTTPError('groq', model, 429, 30.0, 'rate limited')
        return GOOD

    monkeypatch.setattr(ces, 'call_chat_completion', fake)
    svc = _svc()
    for _ in range(6):
        assert asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False))
    assert calls.count('groq') == 1
    assert svc._health['groq'].seconds_until_available() > 0


def test_bad_key_disables_provider_and_all_dead_detected(monkeypatch):
    async def fake(provider, *, model=None, **kw):
        raise ProviderHTTPError(provider.name, model, 401, None, 'bad key')

    monkeypatch.setattr(ces, 'call_chat_completion', fake)
    svc = _svc()
    assert asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False)) is None
    assert svc.all_providers_dead
