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


def test_groq_429_falls_back_to_gemini_then_nvidia(monkeypatch):
    calls = []

    async def fake(provider, *, model=None, **kw):
        calls.append(provider.name)
        if provider.name == 'groq':
            raise ProviderHTTPError('groq', model, 429, 60.0, 'rate limited')
        if provider.name == 'gemini':
            raise ProviderHTTPError('gemini', model, 404, None, 'model gone')  # every gemini model retired
        return GOOD

    monkeypatch.setattr(ces, 'call_chat_completion', fake)
    svc = _svc()
    r = asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False))
    assert r is not None
    # Round-robin may start anywhere, but the row must end on NVIDIA and never on template text.
    assert calls[-1] == 'nvidia'
    assert svc._health['gemini'].dead and svc._health['groq'].seconds_until_available() > 0


def test_rpm_pacing_prefers_free_provider_and_spaces_requests(monkeypatch):
    sleeps = []

    async def fake_sleep(s):
        sleeps.append(s)

    async def fake(provider, *, model=None, **kw):
        return GOOD

    monkeypatch.setattr(ces, 'call_chat_completion', fake)
    monkeypatch.setattr(ces.asyncio, 'sleep', fake_sleep)
    svc = ces.ContentEnrichmentService(api_key='g', gemini_api_key='', nvidia_api_key='')
    svc._health['groq'].min_interval_s = 6.0  # 10 RPM
    asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False))
    assert sleeps == []                       # first request is immediate
    asyncio.run(svc.enrich(title='t', company='c', allow_fallback=False))
    assert 0 < sleeps[0] <= 6.0               # second waits for the slot


def test_response_format_400_is_retried_not_treated_as_retired_model():
    import httpx
    from services import llm_providers as lp
    seen = []

    def handler(request):
        import json
        body = json.loads(request.content)
        seen.append('response_format' in body)
        if 'response_format' in body:
            return httpx.Response(400, text='response_format json_object is not supported')
        return httpx.Response(200, json={'choices': [{'message': {'content': '{}'}}]})

    real = httpx.AsyncClient
    orig = lp.httpx.AsyncClient
    lp.httpx.AsyncClient = lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    try:
        out = asyncio.run(lp.call_chat_completion(lp.nvidia_provider('k', 'm'), system_prompt='s', user_prompt='u'))
    finally:
        lp.httpx.AsyncClient = orig
    assert out == '{}' and seen == [True, False]
