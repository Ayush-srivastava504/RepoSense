# Complete Hugging Face Model Migration Guide

**Comprehensive guide for RepoSense model migration from local storage to Hugging Face Hub.**

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Architecture](#architecture)
4. [Setup Instructions](#setup-instructions)
5. [Configuration](#configuration)
6. [Deployment](#deployment)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Usage](#advanced-usage)

---

## Overview

RepoSense has been migrated to use **Hugging Face Hub** for model management:

- **No large files in Git** - Models download on-demand
- **Automatic caching** - Downloaded models cached locally
- **Easy deployment** - Works with Docker, K8s, Railway, Heroku
- **Custom models** - Use fine-tuned models from Hugging Face
- **Private models** - Support for private repositories

---

## What Changed

### Before Migration 

```
Repository Structure:
├── services/api/models/
│   ├── codebert_quantized/          (500MB - committed to Git!)
│   ├── codebert_onnx/               (400MB - committed to Git!)
│   └── codebert_tokenizer/          (100MB - committed to Git!)
├── services/api/neural-generator/models/
│   └── Qwen3-0.6B-Q4_K_M.gguf      (400MB - committed to Git!)
```

**Problems:**
- Large repository (~2GB just for models)
- Slow clones
- Hard to update models
- Doesn't scale to multiple models
- Wasteful deployment

---

### After Migration

```
Repository Structure:
├── .env                             (Configuration only)
├── .model_cache/                    (Local cache, not committed)
├── services/api/src/utils/
│   └── model_downloader.py         (New: Download models)
├── scripts/
│   ├── setup_models.py             (New: Interactive setup)
│   └── upload_model_to_hf.py       (New: Upload custom models)
```

**Benefits:**
- Repository ~50MB (no models)
- Fast clones
- Easy model updates
- Scales to hundreds of models
- Efficient deployment

---

## Architecture

### Model Management Flow

```
┌─────────────────────────────────────────┐
│   First Run or Model Update             │
└──────────────────┬──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Check Environment   │
        │  Variables           │
        └──────────────┬───────┘
                       │
                       ▼
        ┌──────────────────────┐
        │  Call model_downloader│
        │  from Hugging Face   │
        └──────────────┬───────┘
                       │
                       ▼
        ┌──────────────────────┐
        │  Download Model to   │
        │  .model_cache/       │
        └──────────────┬───────┘
                       │
                       ▼
        ┌──────────────────────┐
        │  Cache Hit: Skip     │
        │  (if already cached) │
        └──────────────┬───────┘
                       │
                       ▼
        ┌──────────────────────┐
        │  Load Model in App   │
        └──────────────────────┘
```

### Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **model_downloader.py** | Download & cache models | `services/api/src/utils/` |
| **setup_models.py** | Interactive setup wizard | `scripts/` |
| **upload_model_to_hf.py** | Upload models to HF | `scripts/` |
| **analysis_engine.py** | Updated to use HF models | `services/api/src/services/` |
| **neural-generator/app.py** | Updated to use HF models | `services/api/neural-generator/src/` |

---

## Setup Instructions

### Option 1: Automatic Setup (Recommended)

```bash
# Run the interactive setup wizard
python scripts/setup_models.py
```

Prompts you for:
- CodeBERT model name
- Qwen model configuration
- Cache directory
- Whether to download models now

Creates `.env` file automatically.

### Option 2: Manual Setup

#### Step 1: Install Dependencies

```bash
pip install \
  transformers \
  huggingface-hub \
  onnxruntime \
  optimum[onnxruntime] \
  llama-cpp-python
```

#### Step 2: Create `.env` File

```env
# Code analysis model
CODEBERT_MODEL=microsoft/codebert-base

# Code generation model (Qwen)
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf

# Cache directory for models
MODEL_CACHE_DIR=.model_cache
```

#### Step 3: Start Application

```bash
python services/app.py
```

Models download automatically on first run (~500MB, takes 2-5 minutes).

---

## Configuration

### Environment Variables

All configuration via environment variables (or `.env` file):

#### CodeBERT Configuration

```bash
# Which model to use for code analysis
CODEBERT_MODEL=microsoft/codebert-base

# Cache directory (optional, defaults to .model_cache)
MODEL_CACHE_DIR=.model_cache
```

**Available CodeBERT Models:**
- `microsoft/codebert-base` (default, 500MB)
- `microsoft/codebert-base-mlm` (alternative)
- Your own fine-tuned version (e.g., `myorg/codebert-custom`)

#### Qwen Configuration

```bash
# Hugging Face repository
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF

# Model file within the repository
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf

# Cache directory (same as CodeBERT)
MODEL_CACHE_DIR=.model_cache
```

**Available Qwen Models:**
- `TheBloke/Qwen2-0.5B-Instruct-GGUF` (default, 300MB)
- `TheBloke/Qwen2-1.5B-Instruct-GGUF` (larger, 700MB)
- Your own fine-tuned version

### Using Custom/Private Models

#### Private Model on Hugging Face

```bash
# Authenticate first
huggingface-cli login

# Use your private repo
export CODEBERT_MODEL=myorg/my-private-codebert
export HF_MODEL_REPO=myorg/my-private-qwen
```

#### Local Model Development

During development, you can use local paths:

```bash
# Not recommended for production, but works locally
export CODEBERT_MODEL=./local_models/my-codebert
export HF_MODEL_REPO=./local_models/my-qwen
```

---

## Deployment

### Docker Deployment

The Docker setup automatically handles model downloads:

```bash
# Standard docker-compose
docker-compose up -d

# Models download on first startup (~2-5 minutes)
docker logs -f repo-sense-api

# Subsequent starts use cached models (fast)
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  api:
    image: repo-sense-api:latest
    environment:
      CODEBERT_MODEL: microsoft/codebert-base
      HF_MODEL_REPO: TheBloke/Qwen2-0.5B-Instruct-GGUF
      HF_MODEL_FILE: qwen2-0.5b-instruct.Q4_K_M.gguf
      MODEL_CACHE_DIR: /app/.model_cache
    volumes:
      - model_cache:/app/.model_cache
    ports:
      - "8000:8000"

volumes:
  model_cache:
```

### Kubernetes Deployment

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: repo-sense-config
data:
  CODEBERT_MODEL: microsoft/codebert-base
  HF_MODEL_REPO: TheBloke/Qwen2-0.5B-Instruct-GGUF
  HF_MODEL_FILE: qwen2-0.5b-instruct.Q4_K_M.gguf
  MODEL_CACHE_DIR: /models

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: model-cache
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: repo-sense-api
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: api
        image: repo-sense-api:latest
        envFrom:
        - configMapRef:
            name: repo-sense-config
        volumeMounts:
        - name: models
          mountPath: /models
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: model-cache
```

### Railway/Heroku Deployment

Set environment variables in deployment dashboard:

```
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=.model_cache
```

Models will download on first deployment (may take 5-10 minutes for cold start).

---

## Troubleshooting

### Issue: "Module transformers not found"

**Solution:**
```bash
pip install transformers huggingface-hub
```

### Issue: "Model download fails / timeout"

**Check:**
1. Internet connection: `ping huggingface.co`
2. HF API status: https://status.huggingface.co
3. Disk space: `df -h`

**Solution:**
```bash
# Clear cache and retry
rm -rf .model_cache
python services/app.py
```

### Issue: "Out of memory"

Qwen uses ~1.5GB RAM. If you get OOM errors:

```bash
# Use smaller model
export HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
export HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf

# Or disable GPU inference (already disabled)
export n_gpu_layers=0
```

### Issue: "HuggingFace authentication required"

For private models:

```bash
# Authenticate
huggingface-cli login

# Or use token
export HF_TOKEN=hf_xxx...
```

### Issue: "Model path not found in cache"

```bash
# Verify HF CLI can access models
huggingface-cli list-repo-files microsoft/codebert-base

# Check your .env file
cat .env

# Manually download
python -c "from transformers import AutoModel; AutoModel.from_pretrained('microsoft/codebert-base')"
```

---

## Advanced Usage

### Using Custom Fine-Tuned Models

1. **Upload model to Hugging Face:**
```bash
python scripts/upload_model_to_hf.py \
  --type codebert \
  --local-path ./my-codebert \
  --repo myorg/my-codebert
```

2. **Use in RepoSense:**
```bash
export CODEBERT_MODEL=myorg/my-codebert
python services/app.py
```

### Model Downloader API

Use the downloader utility in your own code:

```python
from services.api.src.utils.model_downloader import get_downloader

downloader = get_downloader()

# Download CodeBERT
codebert_info = downloader.download_codebert("microsoft/codebert-base")
model = codebert_info["model"]
tokenizer = codebert_info["tokenizer"]

# Download Qwen
qwen_info = downloader.download_qwen_gguf(
    repo_id="TheBloke/Qwen2-0.5B-Instruct-GGUF",
    filename="qwen2-0.5b-instruct.Q4_K_M.gguf"
)
model_path = qwen_info["local_path"]

# List cached models
cached = downloader.get_cached_models()
print(cached)

# Clear cache
downloader.clear_cache()
```

### Monitoring Model Usage

Check what's cached:

```bash
# List all cached models
ls -lh .model_cache/

# Check disk usage
du -sh .model_cache/
```

### Fallback Mode

If models unavailable, code analysis still works via patterns:

```python
# In analysis_engine.py
if self.codebert_available:
    # Use ML-based analysis
else:
    # Use pattern-based analysis (always available)
```

---

## FAQ

**Q: Will the models always download on startup?**
A: No, only on first run or after cache clear. Subsequent runs use cached models.

**Q: Can I use different models in different environments?**
A: Yes! Use environment variables. Dev can use `microsoft/codebert-base`, prod can use your fine-tuned model.

**Q: What if I'm offline?**
A: Models must download once, then work offline from cache.

**Q: Can I use multiple models?**
A: Yes! Modify `model_downloader.py` to support multiple CodeBERT or Qwen models.

**Q: How do I update models?**
A: Just change the environment variable and restart. Old cache is cleaned up automatically.

---

## Related Documents

- **SETUP_COMPLETE.md** - Quick start (5 minutes)
- **HUGGINGFACE_MODEL_GUIDE.md** - Uploading custom models
- **MODEL_CONFIGURATION.md** - Configuration reference
- **MODEL_MIGRATION_SUMMARY.md** - What changed summary

---

**Everything is set up! Start with `SETUP_COMPLETE.md` if you're new.**
