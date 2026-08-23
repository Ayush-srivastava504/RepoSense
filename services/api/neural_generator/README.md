# neural_generator — Local LLM Service

A minimal FastAPI wrapper around a local GGUF model (via `llama-cpp-python`)
that provides text generation for the core API and the RAG service, without
depending on an external LLM provider.

## Structure

```
src/
  app.py   FastAPI app; loads the model at startup and exposes /generate
```

## Running locally

```bash
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8002
```

Or via Docker: `docker build -t reposense-neural . && docker run -p 8002:8002 -v <model-dir>:/app/models reposense-neural`.

A GGUF model file must be present at `MODEL_PATH` before the service can
generate text; if it isn't found, the service starts but returns `503` from
`/generate` until a valid model is mounted.

## Endpoints

- `POST /generate` — generate text from a prompt
  - Request body: `prompt`, `max_tokens` (default 2500), `temperature`
    (default 0.55), `top_k` (default 50), `top_p` (default 0.92)

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_PATH` | `/app/models/Qwen3-0.6B-Q4_K_M.gguf` | Path to the GGUF model file |
| `LLM_N_THREADS` | `2` | CPU threads used for inference |
| `LLM_N_GPU_LAYERS` | `0` | Layers offloaded to GPU (0 = CPU-only) |
| `LLM_N_CTX` | `4096` | Context window size |

The core API and RAG service reach this service via `NEURAL_GENERATOR_URL` /
`LLM_ENDPOINT` respectively (default `http://localhost:8002`).
