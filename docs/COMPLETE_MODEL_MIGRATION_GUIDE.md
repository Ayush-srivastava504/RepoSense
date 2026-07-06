# Model Handling: Historical Migration Notes

> **This is a historical document.** It originally described a migration from models committed directly to Git to a Hugging-Face-Hub-download-on-demand design (`CODEBERT_MODEL`, `HF_MODEL_REPO`, `HF_MODEL_FILE`, `MODEL_CACHE_DIR`). That HF-download design has itself since been superseded for the model that actually matters at runtime. This version corrects the guide to reflect what's true today, while keeping the migration history for context. For the authoritative current state, see [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md) — this document exists for background, not as a setup guide.

## Timeline, as best reconstructed from the code

### Stage 1 — Models committed to Git (earliest)
Model weights lived directly in the repository under paths like `services/api/models/` and `services/api/neural-generator/models/`. Large, slow to clone, hard to update.

### Stage 2 — Hugging Face Hub download-on-demand
The intended fix: fetch models from HF Hub at runtime/build time instead of committing them, controlled by environment variables:

```env
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=.model_cache
```

This left behind two pieces of code that still exist in the repo:
- `services/api/src/configs/ml_config.py` — defines a `ModelConfig` Pydantic settings class with `MODEL_NAME` (prefixed `MODEL_`), `DEVICE`, `MAX_TOKENS`, `QUANTIZATION_ENABLED`, `MODEL_CACHE_DIR`.
- `services/api/src/utils/model_downloader.py` — a `ModelDownloader` class with `download_codebert()` and `download_qwen_gguf()` methods, still defaulting to `TheBloke/Qwen2-0.5B-Instruct-GGUF`.

### Stage 3 — What's actually running today

Neither piece from Stage 2 is called anywhere in the current codebase (`grep -rn "ModelDownloader" services/` finds only the class definition itself — zero call sites). Instead:

- **Code review** (`analysis_engine.py`) is a regex/pattern-based static analyzer. It never loads CodeBERT, HuggingFace Transformers, or any model. `CODEBERT_MODEL` and everything in `ModelConfig` have no effect on it.
- **Text generation** (Neural Generator) loads a **Qwen3-0.6B-Q4_K_M GGUF** file via `llama-cpp-python`, but instead of downloading it from Hugging Face Hub, `neural_generator/Dockerfile` `curl`s it directly from a **GitHub Release** at build time:
  ```dockerfile
  RUN mkdir -p /app/models && \
      curl -L https://github.com/Ayush-srivastava504/RepoSense/releases/download/models/Qwen3-0.6B-Q4_K_M.gguf \
      -o /app/models/Qwen3-0.6B-Q4_K_M.gguf
  ```
  The model is baked into the image, not downloaded at container start. `HF_MODEL_REPO`/`HF_MODEL_FILE` play no role here — the only relevant env var is `MODEL_PATH`, which just tells `llama-cpp-python` where to find the already-present file.
- **The one thing that genuinely still downloads from Hugging Face Hub at runtime** is the RAG service's embedding model, `all-MiniLM-L6-v2`, fetched by `sentence-transformers` on first use and cached via `HF_HOME`.

So the "migration" this document originally described (committed weights → HF Hub download) was a real step for CodeBERT/Qwen2 in an earlier version of the project, but the current Qwen3 setup moved to a third pattern — "bake into the image from a GitHub Release" — that this doc never covered, and CodeBERT was dropped from the request path entirely in favor of pattern matching.

## Why this matters if you're reading old references to this migration

If you find other documentation, comments, or scripts referencing:
- `scripts/setup_models.py` — doesn't exist in this repo
- `HUGGINGFACE_MODEL_GUIDE.md`, `MODEL_MIGRATION_SUMMARY.md` — don't exist in this repo
- Kubernetes/Railway/Heroku config blocks setting `CODEBERT_MODEL`/`HF_MODEL_REPO`/`HF_MODEL_FILE` — harmless to set, but have no effect on the running application today

...treat them as historical or aspirational rather than instructions to follow. For an actual deployment, see [docs/DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md), and for actual env vars, see [docs/MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md).

## If you want to genuinely revive the CodeBERT path

`ml_config.py` and `model_downloader.py` are still present and functional as standalone code — they're just not called. Wiring CodeBERT-based analysis back in would mean:
1. Importing `ml_settings.model` (or a new setting) into `analysis_engine.py` or `ai_service.py`.
2. Calling `ModelDownloader().download_codebert(...)` somewhere in the startup path (or lazily, like the RAG service's `Embedder` singleton does for `all-MiniLM-L6-v2`).
3. Replacing or augmenting the `PatternRule`/`CodeAnalyzer` regex logic with actual model inference.

None of that exists today — this is a description of the gap, not a completed feature.

## Related docs

- [docs/MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md) — current, authoritative env var reference
- [docs/SETUP_COMPLETE.md](./SETUP_COMPLETE.md) — quick-start for getting models running today
- [services/api/neural_generator/README.md](../services/api/neural_generator/README.md)
- [services/api/rag/README.md](../services/api/rag/README.md)
