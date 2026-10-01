# Live check of every configured LLM provider (Groq / Gemini / NVIDIA), run on the
# server: docker compose exec -T api python scripts/verify_providers.py
# Sends one tiny JSON request per provider model and prints status, latency and
# whether the model id is still valid. Exit 1 if NO provider works.
import asyncio, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from configs.config import settings
from services.llm_providers import (ProviderHTTPError, call_chat_completion, enabled_providers,
                                    gemini_provider, groq_provider, nvidia_provider)


async def main() -> int:
    providers = enabled_providers(
        groq_provider(settings.GROQ_API_KEY, settings.GROQ_MODEL),
        gemini_provider(settings.GEMINI_API_KEY, settings.GEMINI_MODEL),
        nvidia_provider(settings.NVIDIA_API_KEY, settings.NVIDIA_MODEL))
    if not providers:
        print('no provider keys configured'); return 1
    ok = 0
    for p in providers:
        for model in p.models:
            t = time.monotonic()
            try:
                out = await call_chat_completion(p, system_prompt='Reply with JSON only.',
                                                 user_prompt='Return {"ok": true}', json_object=True,
                                                 timeout_s=30, model=model)
                print(f'OK    {p.name:7} {model}  {time.monotonic()-t:.1f}s  -> {out.strip()[:60]!r}'); ok += 1
            except ProviderHTTPError as e:
                print(f'FAIL  {p.name:7} {model}  HTTP {e.status_code} retry_after={e.retry_after} {e.body[:120]!r}')
            except Exception as e:
                print(f'FAIL  {p.name:7} {model}  {type(e).__name__}: {e}')
            await asyncio.sleep(2)
    print(f'{ok} working model(s)'); return 0 if ok else 1

sys.exit(asyncio.run(main()))
