import asyncio

import pytest

from services import llm_text
from services.llm_providers import ProviderConfig


def _run(coro):
    return asyncio.run(coro)


def test_raises_when_no_provider_configured(monkeypatch):
    monkeypatch.setattr(llm_text, '_providers', lambda: [])
    with pytest.raises(llm_text.LLMUnavailableError):
        _run(llm_text.generate_text('hi'))


def test_falls_through_to_next_provider(monkeypatch):
    a = ProviderConfig('groq', 'https://a.example', 'k1', 'm1')
    b = ProviderConfig('gemini', 'https://b.example', 'k2', 'm2')
    monkeypatch.setattr(llm_text, '_providers', lambda: [a, b])
    calls = []

    async def fake_call(provider, **kwargs):
        calls.append((provider.name, kwargs['model']))
        if provider.name == 'groq':
            raise RuntimeError('rate limited')
        return '  hello  '

    monkeypatch.setattr(llm_text, 'call_chat_completion', fake_call)
    assert _run(llm_text.generate_text('hi')) == 'hello'
    # every groq model was tried before moving on to gemini
    assert all(name == 'groq' for name, _ in calls[:-1])
    assert calls[-1] == ('gemini', 'm2')


def test_empty_responses_count_as_failures(monkeypatch):
    a = ProviderConfig('groq', 'https://a.example', 'k1', 'm1')
    monkeypatch.setattr(llm_text, '_providers', lambda: [a])

    async def fake_call(provider, **kwargs):
        return '   '

    monkeypatch.setattr(llm_text, 'call_chat_completion', fake_call)
    with pytest.raises(llm_text.LLMUnavailableError):
        _run(llm_text.generate_text('hi'))
