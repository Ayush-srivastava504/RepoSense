# Model Configuration Reference

> The environment variables below are the ones the code actually reads today. Earlier versions of this file documented a Hugging-Face-Hub-download model of `CODEBERT_MODEL` / `HF_MODEL_REPO` / `HF_MODEL_FILE` / `MODEL_CACHE_DIR` pointed at `TheBloke/Qwen2-0.5B-Instruct-GGUF`. That download path exists as dead code (`src/utils/model_downloader.py`) but **nothing in the running application calls it**, and neither `CODEBERT_MODEL` nor `HF_MODEL_REPO`/`HF_MODEL_FILE` are read by anything that runs. See "What actually happens today" before configuring anything here.

## What actually happens today

There are two separate model-shaped things in this codebase, and they work completely differently:

1. **Code review "AI" (`services/api/src/services/analysis_engine.py`)** is a regex/pattern-based static analyzer (`PatternRule` + `CodeAnalyzer`) — it does **not** load CodeBERT, HuggingFace Transformers, or any ML model at all, despite `ml_config.py` defining a `MODEL_NAME` setting that defaults to `microsoft/codebert-base`. Nothing in `analysis_engine.py` imports `ml_config` or `transformers`. If other docs in this repo say "CodeBERT-based static analysis," that describes the intended/historical design, not what `analyze()` currently does.
2. **Text generation** (LinkedIn optimizer, resume generation, README generation) goes through the Neural Generator microservice, which loads a **Qwen3-0.6B-Q4_K_M GGUF** model via `llama-cpp-python`. This model is **baked into the Docker image at build time** (`neural_generator/Dockerfile` runs `curl -L .../releases/download/models/Qwen3-0.6B-Q4_K_M.gguf -o /app/models/Qwen3-0.6B-Q4_K_M.gguf`) — it is not downloaded from Hugging Face Hub at runtime, and `HF_MODEL_REPO`/`HF_MODEL_FILE` play no role in loading it.

So: `ml_config.py`'s `ModelConfig` class and `model_downloader.py`'s `ModelDownloader` class are configuration/utility code left over from an earlier design that isn't wired into any route or service today. They don't error if left at their defaults — they just don't do anything.

## Variables that are actually read

### Neural Generator (`services/api/neural_generator/src/app.py`)

| Variable | Default | Description |
|---|---|---|
| `MODEL_PATH` | `/app/models/Qwen3-0.6B-Q4_K_M.gguf` | Path to the GGUF file on disk inside the container. Only worth overriding if running outside the prebuilt image |
| `LLM_N_THREADS` | `2` | CPU threads for inference (`docker-compose.yml` overrides this to `4`) |
| `LLM_N_GPU_LAYERS` | `0` | GPU offload layers — `0` means fully CPU-bound |
| `LLM_N_CTX` | `4096` | Context window size in tokens |

If `MODEL_PATH` doesn't exist, `load_model()` logs an error and leaves `llm = None` — the service still starts, but `POST /generate` returns `503 Model not loaded. Check MODEL_PATH.` instead of crashing, and `GET /health` reports `model_loaded: false`.

Per-request generation parameters (request body fields, not env vars) are `max_tokens` (default 2500), `temperature` (0.55), `top_k` (50), `top_p` (0.92); `repeat_penalty` is hardcoded to `1.2` and isn't configurable from the request.

### RAG Service (`services/api/rag/src/config.py`)

| Variable | Default | Description |
|---|---|---|
| `VECTOR_STORE_PATH` | `/app/data/faiss_index` | Where the FAISS index + pickled metadata are persisted |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model name — this one *is* downloaded from Hugging Face Hub at first use (`sentence_transformers.SentenceTransformer`), cached under `HF_HOME` (`/root/.cache/huggingface` per `docker-compose.yml`) |
| `LLM_ENDPOINT` | `http://neural-generator:8002/generate` | Where the RAG service calls out to for generation |

### CodeBERT / code-analysis config (`services/api/src/configs/ml_config.py`) — defined but unused

`ModelConfig` (env prefix `MODEL_`) defines `MODEL_NAME` (default `microsoft/codebert-base`), `DEVICE` (`cpu`), `MAX_TOKENS` (`512`), `QUANTIZATION_ENABLED` (`False`), and `MODEL_CACHE_DIR` (`./.model_cache`). None of these are imported by `analysis_engine.py`, `ai_service.py`, or `auto_fixer.py` today — setting them has no observable effect on code review behavior. The pattern-based analyzer's rules are hardcoded directly in `analysis_engine.py`, not environment-configurable.

The same file also defines `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` and `AWS_ACCESS_KEY` / `AWS_SECRET_KEY` — note these are *different variable names* than the ones `configs/config.py` actually uses for the live Razorpay/S3 integration (`RAZORPAY_KEY_ID`/`SECRET`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`). Treat `ml_config.py` as a module that predates the Stripe→Razorpay migration and the current pattern-based analyzer, not as an active source of truth.

## `.env` for local development

```env
# Neural Generator (only relevant if running it outside Docker — the prebuilt
# image already has the model baked in)
MODEL_PATH=/app/models/Qwen3-0.6B-Q4_K_M.gguf
LLM_N_THREADS=4
LLM_N_GPU_LAYERS=0
LLM_N_CTX=4096

# RAG
VECTOR_STORE_PATH=/app/data/faiss_index
EMBEDDING_MODEL=all-MiniLM-L6-v2
LLM_ENDPOINT=http://localhost:8002/generate
```

There is no committed `.env.example` at the repo root, and `services/api/rag/src/.env.example` exists but is empty — set these directly.

## Running the Neural Generator outside Docker

Since the model ships baked into the container image, running it bare-metal means fetching the GGUF file yourself first:

```bash
mkdir -p models
curl -L https://github.com/Ayush-srivastava504/RepoSense/releases/download/models/Qwen3-0.6B-Q4_K_M.gguf \
  -o models/Qwen3-0.6B-Q4_K_M.gguf

cd services/api/neural_generator
pip install -r requirements.txt
MODEL_PATH=$(pwd)/../../../models/Qwen3-0.6B-Q4_K_M.gguf \
  uvicorn src.app:app --host 0.0.0.0 --port 8002
```

## Disk / memory footprint

| Component | Approx. size | Notes |
|---|---|---|
| Qwen3-0.6B-Q4_K_M GGUF | ~400MB | Baked into the `neural-generator` image at build time |
| `all-MiniLM-L6-v2` (sentence-transformers) | ~90MB | Downloaded on first RAG request, cached in `HF_HOME` |
| CodeBERT (`microsoft/codebert-base`) | Not downloaded | `analysis_engine.py` doesn't load it — see above |

`docker-compose.yml` sets `mem_limit: 1024m` on both `neural-generator` and `rag`.

## Troubleshooting

### Neural Generator returns `503 Model not loaded`
Check the container actually has the GGUF file: `docker compose exec neural-generator ls -la /app/models/`. If it's missing, the image build's `curl` step likely failed — check build logs, then re-pull or rebuild.

### RAG service is slow on first request
`SentenceTransformer` downloads `all-MiniLM-L6-v2` from Hugging Face Hub the first time `Embedder()` is instantiated (a lazy singleton — see `routes.py`). Subsequent requests use the `HF_HOME`-cached copy. Without a persistent volume for `HF_HOME`, this download repeats on every container restart.

### "I changed `CODEBERT_MODEL` / `HF_MODEL_REPO` and nothing changed"
Expected — see "What actually happens today" above. Neither variable is read by any code path that runs today.

## Related docs

- [services/api/neural_generator/README.md](../services/api/neural_generator/README.md)
- [services/api/rag/README.md](../services/api/rag/README.md)
- [services/api/README.md](../services/api/README.md) — full Core API configuration
