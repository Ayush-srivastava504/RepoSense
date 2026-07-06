# Model Setup — Quick Start

> This previously described a `python scripts/setup_models.py` interactive wizard. **That script doesn't exist in this repo** — there is no `scripts/` directory at all. If you're looking for it, it was either never committed or removed; the manual steps below are the actual supported path today.

## Fastest path: Docker Compose

You don't need to set up any models by hand — the `neural-generator` and `rag` images on GHCR already have everything baked in or configured to fetch on first use:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d neural-generator rag
```

- `neural-generator` starts with the Qwen3-0.6B-Q4_K_M GGUF file already inside the image (baked in during the image build via `curl` from a GitHub Release — see `neural_generator/Dockerfile`).
- `rag` downloads `all-MiniLM-L6-v2` (sentence-transformers, ~90MB) from Hugging Face Hub the first time it's needed, caching it under the `huggingface_cache` volume.

Check both came up healthy:

```bash
curl http://localhost:8002/health   # {"status": "ok", "model_loaded": true}
curl http://localhost:8001/health   # {"status": "ok"}
```

## Manual path (without Docker)

### 1. Neural Generator

```bash
mkdir -p models
curl -L https://github.com/Ayush-srivastava504/RepoSense/releases/download/models/Qwen3-0.6B-Q4_K_M.gguf \
  -o models/Qwen3-0.6B-Q4_K_M.gguf

cd services/api/neural_generator
pip install -r requirements.txt   # fastapi, uvicorn, llama-cpp-python
MODEL_PATH=$(pwd)/../../../models/Qwen3-0.6B-Q4_K_M.gguf \
  uvicorn src.app:app --host 0.0.0.0 --port 8002
```

### 2. RAG Service

```bash
cd services/api/rag
pip install -r requirements.txt   # includes torch (CPU wheel), sentence-transformers, faiss-cpu
uvicorn src.app:app --host 0.0.0.0 --port 8001
```

No model download step needed — `sentence-transformers` fetches `all-MiniLM-L6-v2` automatically on first request and caches it in `~/.cache/huggingface` (override with `HF_HOME`).

### 3. Core API

The Core API doesn't need any model files itself — its "AI" code review is a regex/pattern analyzer (`analysis_engine.py`), not a loaded ML model. It just needs `RAG_SERVICE_URL` and `NEURAL_GENERATOR_URL` pointed at the two services above. See [services/api/README.md](../services/api/README.md) for its full setup.

## Default models actually used

| Model | Approx. size | Where it comes from | Used for |
|---|---|---|---|
| Qwen3-0.6B-Q4_K_M (GGUF) | ~400MB | Baked into `neural-generator` image from a GitHub Release | LinkedIn/resume/README text generation |
| all-MiniLM-L6-v2 | ~90MB | Downloaded from Hugging Face Hub on first RAG request | Semantic search embeddings |
| CodeBERT (`microsoft/codebert-base`) | — | Not downloaded, not loaded anywhere | Referenced in `ml_config.py` but unused — code review is pattern-based, see [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md) |

There's no `.model_cache/` directory used by anything running today — that was part of the earlier Hugging-Face-download design described in [COMPLETE_MODEL_MIGRATION_GUIDE.md](./COMPLETE_MODEL_MIGRATION_GUIDE.md), which itself has since been superseded by the "bake the GGUF into the image" approach above.

## Troubleshooting

### `Module not found` on either microservice
```bash
pip install -r services/api/neural_generator/requirements.txt   # or rag/requirements.txt
```
Each sub-service has its own `requirements.txt` — installing the Core API's doesn't cover them.

### Neural Generator says "Model not loaded"
The GGUF file isn't at `MODEL_PATH`. If you're running the prebuilt Docker image this shouldn't happen (it's baked in); if you're running bare-metal, re-check the `curl` download step above.

### RAG service hangs on first request
It's downloading `all-MiniLM-L6-v2` from Hugging Face Hub — this can take a minute on a slow connection. Subsequent requests use the cache.

### Out of memory
`docker-compose.yml` caps both `neural-generator` and `rag` at `mem_limit: 1024m`. If the container is OOM-killed, that's your signal — either raise the limit or reduce `LLM_N_CTX` (default 4096) on the neural generator.

## Full documentation

- [docs/MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md) — full environment variable reference, and what's actually wired up vs. dead code
- [docs/COMPLETE_MODEL_MIGRATION_GUIDE.md](./COMPLETE_MODEL_MIGRATION_GUIDE.md) — historical context on how model handling evolved
- [services/api/neural_generator/README.md](../services/api/neural_generator/README.md)
- [services/api/rag/README.md](../services/api/rag/README.md)

There is no `HUGGINGFACE_MODEL_GUIDE.md` or `MODEL_MIGRATION_SUMMARY.md` in this repo, despite being referenced by an earlier version of this file.
