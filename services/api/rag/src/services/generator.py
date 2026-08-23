# Module: rag/src/services/generator.py
# Defines class(es): Generator
#
#

import httpx
from ..config import LLM_ENDPOINT

class Generator:

    @staticmethod
    async def generate(prompt: str, context: str) -> str:
        full_prompt = f'Generate a README.md for the following code context. Be detailed and use markdown.\n\nContext:\n{context}\n\nREADME:\n'
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(LLM_ENDPOINT, json={'prompt': full_prompt, 'max_tokens': 1500})
            return resp.json()['text']
