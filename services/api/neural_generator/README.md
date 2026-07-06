# RepoSense Neural Generator

> Minimal FastAPI wrapper around `llama-cpp-python`, serving a local **Qwen3-0.6B-Q4_K_M GGUF** model, CPU-only. Runs on **port 8002**. Called by the RAG service (README generation) and, indirectly, by the Core API's resume and LinkedIn features.

## Overview

The entire service is one file, `src/app.py` (~110 lines) — there's no router split, no service layer, no schema module beyond a single Pydantic request model. It exists purely to keep the LLM loaded in one process and expose it over HTTP so the Core API and RAG service don't each need their own copy in memory.

## Endpoints

```
POST /generate   — { prompt, max_tokens?, temperature?, top_k?, top_p? } → { text }
GET  /health     — { status, model_loaded }
```

Note: unlike the Core API and RAG service, these are **not** namespaced under `/api/...` — they're mounted directly at the root (`/generate`, `/health`).

### `POST /generate` request body

| Field | Type | Default |
|---|---|---|
| `prompt` | `string` | required |
| `max_tokens` | `int` | `2500` |
| `temperature` | `float` | `0.55` |
| `top_k` | `int` | `50` |
| `top_p` | `float` | `0.92` |

`repeat_penalty` (`1.2`) and the stop sequence (`["</s>"]`) are hardcoded in `app.py` and aren't request-configurable. If the model isn't loaded, this returns `503 Model not loaded. Check MODEL_PATH.`; generation exceptions return `500` with the exception message.

## Model loading

```python
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/Qwen3-0.6B-Q4_K_M.gguf")
N_THREADS = int(os.getenv("LLM_N_THREADS", "2"))
N_GPU_LAYERS = int(os.getenv("LLM_N_GPU_LAYERS", "0"))
N_CTX = int(os.getenv("LLM_N_CTX", "4096"))
```

`load_model()` runs once at import time (module-level `load_model()` call, not inside a FastAPI startup event). If `MODEL_PATH` doesn't exist on disk, it logs an error and leaves the global `llm = None` — the app still starts and serves `/health` (reporting `model_loaded: false`), it just can't generate anything until the file is present and the process restarts.

**The model file is baked into the Docker image at build time**, not downloaded at container startup:

```dockerfile
RUN mkdir -p /app/models && \
    curl -L https://github.com/Ayush-srivastava504/RepoSense/releases/download/models/Qwen3-0.6B-Q4_K_M.gguf \
    -o /app/models/Qwen3-0.6B-Q4_K_M.gguf
```

There is no Hugging Face Hub download path for this model in the current code — earlier docs describing `HF_MODEL_REPO`/`HF_MODEL_FILE` env vars for this service don't apply; see [docs/MODEL_CONFIGURATION.md](../../../docs/MODEL_CONFIGURATION.md) for the full explanation of what's live vs. legacy.

## Running

### Docker (recommended — model is already baked in)

```bash
cd services/api/neural_generator
docker build -t reposense-neural:latest .
docker run -p 8002:8002 -e LLM_N_THREADS=4 reposense-neural:latest
```

The Dockerfile's `HEALTHCHECK` curls `/health` every 30s.

### Bare metal (you fetch the model yourself)

```bash
mkdir -p models
curl -L https://github.com/Ayush-srivastava504/RepoSense/releases/download/models/Qwen3-0.6B-Q4_K_M.gguf \
  -o models/Qwen3-0.6B-Q4_K_M.gguf

cd services/api/neural_generator
pip install -r requirements.txt   # fastapi, uvicorn, llama-cpp-python — that's the entire list
MODEL_PATH=$(pwd)/../../../models/Qwen3-0.6B-Q4_K_M.gguf \
  uvicorn src.app:app --host 0.0.0.0 --port 8002
```

**Interactive docs:** http://localhost:8002/docs

## Configuration

```env
MODEL_PATH=/app/models/Qwen3-0.6B-Q4_K_M.gguf
LLM_N_THREADS=4       # docker-compose.yml sets this to 4; app.py's own default is 2
LLM_N_GPU_LAYERS=0    # CPU-only by design; raising this assumes a CUDA/Metal build of llama-cpp-python, which isn't what's installed here
LLM_N_CTX=4096
```

`docker-compose.yml` also caps this service at `mem_limit: 1024m` / `cpus: 1.0`, and its healthcheck uses a `start_period: 180s` to allow for model load time before failing checks — a cold start can genuinely take close to that long on constrained hardware.

## Testing manually

```bash
curl http://localhost:8002/health

curl -X POST http://localhost:8002/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a one-sentence description of a REST API.", "max_tokens": 60}'
```

## Troubleshooting

| Issue | Cause |
|---|---|
| `503 Model not loaded` | `MODEL_PATH` doesn't point at an existing file — check the build actually completed the `curl` step, or that a bare-metal `MODEL_PATH` override is correct |
| Slow first response after container start | Expected — GGUF model load into RAM happens once at process start, not per-request; this is what the 180s `start_period` in the Compose healthcheck accounts for |
| Requests timing out from the RAG service | RAG's `Generator.generate()` uses a 120s client timeout — if generation with your `max_tokens`/thread count regularly exceeds that on your hardware, lower `max_tokens` in the caller or raise `LLM_N_THREADS` |
| High CPU usage | Expected — this is deliberately CPU-only (`LLM_N_GPU_LAYERS=0`); scale `LLM_N_THREADS` to available cores, not GPU settings |

## Related docs

- [docs/MODEL_CONFIGURATION.md](../../../docs/MODEL_CONFIGURATION.md) — what's actually live vs. legacy config
- [services/api/rag/README.md](../rag/README.md) — primary caller of this service
- [services/api/README.md](../README.md)