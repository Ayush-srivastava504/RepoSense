# Module: src/services/llm_providers.py
# Defines component(s)/export(s): ProviderConfig, call_chat_completion
#
# Groq, Google Gemini (via its OpenAI-compatibility endpoint — see
# https://ai.google.dev/gemini-api/docs/openai), and NVIDIA NIM
# (https://integrate.api.nvidia.com/v1) all accept the same OpenAI-style
# {model, messages, ...} POST to /chat/completions with a Bearer token, so
# one request shape and one response parse covers all three. That's what
# lets content_enrichment_service.py (and friends) try one provider, then
# fall through to the next on failure, without three separate client
# implementations.

from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_url: str
    api_key: str
    model: str


def groq_provider(api_key: str, model: str) -> ProviderConfig:
    return ProviderConfig('groq', 'https://api.groq.com/openai/v1/chat/completions', api_key, model)


def gemini_provider(api_key: str, model: str) -> ProviderConfig:
    return ProviderConfig('gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', api_key, model)


def nvidia_provider(api_key: str, model: str) -> ProviderConfig:
    return ProviderConfig('nvidia', 'https://integrate.api.nvidia.com/v1/chat/completions', api_key, model)


def enabled_providers(*candidates: Optional[ProviderConfig]) -> list[ProviderConfig]:
    """Drops any provider whose api_key is empty (i.e. not configured)."""
    return [p for p in candidates if p is not None and p.api_key]


async def call_chat_completion(
    provider: ProviderConfig,
    *,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
    timeout_s: float = 30,
    json_object: bool = True,
) -> str:
    """POSTs one chat-completion request and returns the raw message content
    string. Raises httpx.HTTPError / ValueError / KeyError on any failure —
    callers are expected to catch and fall through to the next provider."""
    payload = {
        'model': provider.model,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_prompt},
        ],
        'temperature': temperature,
    }
    if json_object:
        payload['response_format'] = {'type': 'json_object'}
    headers = {'Authorization': f'Bearer {provider.api_key}', 'Content-Type': 'application/json'}
    async with httpx.AsyncClient(timeout=timeout_s) as client:
        resp = await client.post(provider.api_url, headers=headers, json=payload)
        resp.raise_for_status()
        body = resp.json()
    return body['choices'][0]['message']['content']
