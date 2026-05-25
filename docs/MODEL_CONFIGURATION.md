# Model Configuration Reference

**Complete environment variable reference and configuration options.**

---

## Quick Reference

```env
# CodeBERT (Code Analysis)
CODEBERT_MODEL=microsoft/codebert-base

# Qwen (Code Generation)
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf

# Cache
MODEL_CACHE_DIR=.model_cache
```

---

## Environment Variables

### CodeBERT Configuration

#### `CODEBERT_MODEL`

**Type:** String  
**Default:** `microsoft/codebert-base`  
**Description:** Hugging Face repository ID for CodeBERT model

**Examples:**
```env
# Official CodeBERT
CODEBERT_MODEL=microsoft/codebert-base

# Fine-tuned variant
CODEBERT_MODEL=microsoft/codebert-base-mlm

# Custom model
CODEBERT_MODEL=myorg/my-codebert

# Specific version
CODEBERT_MODEL=myorg/codebert@v1.0
```

**Available Models:**
| Model | Size | Use Case |
|-------|------|----------|
| `microsoft/codebert-base` | 500MB | General code analysis (default) |
| `microsoft/codebert-base-mlm` | 500MB | Alternative variant |

### Qwen Configuration

#### `HF_MODEL_REPO`

**Type:** String  
**Default:** `TheBloke/Qwen2-0.5B-Instruct-GGUF`  
**Description:** Hugging Face repository ID for Qwen GGUF model

**Examples:**
```env
# Small lightweight (default)
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF

# Medium size
HF_MODEL_REPO=TheBloke/Qwen2-1.5B-Instruct-GGUF

# Custom quantized
HF_MODEL_REPO=myorg/qwen-custom
```

#### `HF_MODEL_FILE`

**Type:** String  
**Default:** `qwen2-0.5b-instruct.Q4_K_M.gguf`  
**Description:** Filename of model within the repository

**Examples:**
```env
# Q4_K_M quantization (recommended)
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf

# Different quantization
HF_MODEL_FILE=qwen2-0.5b-instruct.Q5_K_M.gguf

# Custom name
HF_MODEL_FILE=my-custom-model.gguf
```

### Cache Configuration

#### `MODEL_CACHE_DIR`

**Type:** String (path)  
**Default:** `.model_cache`  
**Description:** Directory to cache downloaded models

**Examples:**
```env
# Local cache (dev)
MODEL_CACHE_DIR=.model_cache

# System cache (Docker)
MODEL_CACHE_DIR=/app/.model_cache

# Shared cache (multi-user)
MODEL_CACHE_DIR=/var/lib/model_cache

# Custom location
MODEL_CACHE_DIR=/mnt/models
```

**Disk Requirements:**
- CodeBERT: ~500MB
- Qwen 0.5B: ~300MB
- Qwen 1.5B: ~700MB
- **Total (default):** ~800MB

---

## Complete `.env` Examples

### Development Setup

```env
# Small, fast setup for local development
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=.model_cache
```

### Production Setup

```env
# Fine-tuned models for production
CODEBERT_MODEL=myorg/codebert-prod
HF_MODEL_REPO=myorg/qwen-prod
HF_MODEL_FILE=qwen-prod-Q4_K_M.gguf
MODEL_CACHE_DIR=/app/.model_cache
```

### Large Model Setup

```env
# Larger models for better accuracy (slower, more memory)
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-1.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-1.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=/models
```

### Low-Resource Setup

```env
# Minimal setup for constrained environments
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=/tmp/cache
```

### Multi-Environment Setup

```env
# Dev
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF

# Production (override with env vars)
CODEBERT_MODEL=myorg/codebert-prod
HF_MODEL_REPO=myorg/qwen-prod

# Staging (private models)
CODEBERT_MODEL=myorg/codebert-staging
HF_MODEL_REPO=myorg/qwen-staging
```

---

## Docker Configuration

### docker-compose.yml

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
    driver: local
```

### Dockerfile

```dockerfile
FROM python:3.10-slim

ENV CODEBERT_MODEL=microsoft/codebert-base
ENV HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
ENV HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
ENV MODEL_CACHE_DIR=/app/.model_cache

WORKDIR /app
COPY services/ /app/

RUN pip install -r requirements.txt

CMD ["python", "app.py"]
```

---

## Kubernetes Configuration

### ConfigMap

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
```

### Deployment

```yaml
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
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: model-cache
```

---

## Railway Configuration

In Railway dashboard, set these environment variables:

```
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=.model_cache
```

---

## Heroku Configuration

```bash
# Via CLI
heroku config:set -a repo-sense \
  CODEBERT_MODEL=microsoft/codebert-base \
  HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF \
  HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf \
  MODEL_CACHE_DIR=/app/.model_cache

# Or in Procfile
web: CODEBERT_MODEL=microsoft/codebert-base python services/app.py
```

---

## Model Size Reference

### CodeBERT Variants

| Model | Size | Memory | Speed |
|-------|------|--------|-------|
| microsoft/codebert-base | 500MB | 1.2GB | Fast |
| microsoft/codebert-base-mlm | 500MB | 1.2GB | Fast |

### Qwen GGUF Variants

| Repository | Model | Size | Memory | Speed |
|------------|-------|------|--------|-------|
| TheBloke/Qwen2-0.5B | Q4_K_M | 300MB | 1.5GB | Fast |
| TheBloke/Qwen2-0.5B | Q5_K_M | 400MB | 2GB | Medium |
| TheBloke/Qwen2-1.5B | Q4_K_M | 700MB | 3GB | Slow |
| TheBloke/Qwen2-1.5B | Q5_K_M | 900MB | 3.5GB | Slow |

### Disk Requirements

```
Total = CodeBERT + Qwen + Metadata + Buffer

Default (0.5B): 500 + 300 + 50 + 50 = ~900MB
Large (1.5B):   500 + 700 + 50 + 50 = ~1.3GB
```

---

## Private Model Setup

### Authenticate

```bash
# Login once
huggingface-cli login
# Token saved to ~/.huggingface/token
```

### Use Private Models

```env
# Private repositories work automatically after login
CODEBERT_MODEL=myorg/private-codebert
HF_MODEL_REPO=myorg/private-qwen
HF_MODEL_FILE=qwen-private.gguf
MODEL_CACHE_DIR=.model_cache
```

### Docker with Private Models

```dockerfile
# Add token build arg
ARG HF_TOKEN

RUN huggingface-cli login --token $HF_TOKEN
# Models can now download from private repos
```

```bash
docker build -t repo-sense --build-arg HF_TOKEN=$HF_TOKEN .
```

---

## Testing Configuration

```bash
# Test CodeBERT
python -c "from transformers import AutoModel, AutoTokenizer; \
    model = AutoModel.from_pretrained('$CODEBERT_MODEL'); \
    print(' CodeBERT OK')"

# Test Qwen
python -c "from huggingface_hub import hf_hub_download; \
    path = hf_hub_download('$HF_MODEL_REPO', '$HF_MODEL_FILE'); \
    print(f' Qwen OK: {path}')"

# Test cache
du -sh $MODEL_CACHE_DIR
```

---

## Troubleshooting

### Models not found

Check environment variables:
```bash
env | grep -E "CODEBERT|HF_MODEL|MODEL_CACHE"
```

### Cache location wrong

```bash
# Check actual cache
python -c "from transformers import AutoModel; \
    import os; \
    print(os.getenv('TRANSFORMERS_CACHE', '~/.cache/huggingface'))"
```

### Permission issues

```bash
# Fix permissions
chmod -R 755 $MODEL_CACHE_DIR
```

---

## Performance Tuning

### Fast Startup

```env
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
```

### High Accuracy

```env
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-1.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-1.5b-instruct.Q5_K_M.gguf
```

### Low Memory

```env
CODEBERT_MODEL=microsoft/codebert-base
HF_MODEL_REPO=TheBloke/Qwen2-0.5B-Instruct-GGUF
HF_MODEL_FILE=qwen2-0.5b-instruct.Q4_K_M.gguf
MODEL_CACHE_DIR=/tmp
```

---

**For more details, see COMPLETE_MODEL_MIGRATION_GUIDE.md** 
