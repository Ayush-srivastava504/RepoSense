# Module: src/services/llm_text.py
#
# One-shot text generation for the interactive tools (resume, cover letter,
# LinkedIn feedback, README generator). Tries the hosted free-tier providers
# configured in .env (Groq -> Gemini -> NVIDIA NIM) and returns the first
# successful response. Replaces the old self-hosted Qwen container, which
# needed ~1 GB of RAM on the server for worse output.

from typing import Optional

from configs.config import settings
from services.llm_providers import (
    ProviderConfig,
    call_chat_completion,
    enabled_providers,
    gemini_provider,
    groq_provider,
    nvidia_provider,
)


class LLMUnavailableError(RuntimeError):
    pass


def _providers() -> list[ProviderConfig]:
    return enabled_providers(
        groq_provider(getattr(settings, 'GROQ_API_KEY', ''), getattr(settings, 'GROQ_MODEL', 'openai/gpt-oss-120b')),
        gemini_provider(getattr(settings, 'GEMINI_API_KEY', ''), getattr(settings, 'GEMINI_MODEL', 'gemini-3.1-flash-lite')),
        nvidia_provider(getattr(settings, 'NVIDIA_API_KEY', ''), getattr(settings, 'NVIDIA_MODEL', 'nvidia/nemotron-3-super-120b-a12b')),
    )


async def generate_text(
    prompt: str,
    *,
    system_prompt: str = 'You are a helpful assistant. Follow the output format exactly.',
    temperature: float = 0.4,
    json_object: bool = False,
    timeout_s: float = 90,
) -> str:
    """Returns the model's reply text. Raises LLMUnavailableError if no provider
    is configured or every provider/model failed."""
    providers = _providers()
    if not providers:
        raise LLMUnavailableError('No LLM provider configured (set GROQ_API_KEY, GEMINI_API_KEY or NVIDIA_API_KEY).')
    errors: list[str] = []
    for provider in providers:
        for model in provider.models:
            try:
                text = await call_chat_completion(
                    provider,
                    system_prompt=system_prompt,
                    user_prompt=prompt,
                    temperature=temperature,
                    timeout_s=timeout_s,
                    json_object=json_object,
                    model=model,
                )
                if text and text.strip():
                    return text.strip()
                errors.append(f'{provider.name}/{model}: empty response')
            except Exception as exc:  # fall through to the next model/provider
                errors.append(f'{provider.name}/{model}: {exc!s}'[:300])
    raise LLMUnavailableError('All LLM providers failed: ' + ' | '.join(errors))
