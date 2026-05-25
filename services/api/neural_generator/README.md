# Neural Generator Service

> FastAPI microservice for local LLM text generation using **Qwen 3 GGUF** model via **llama-cpp-python**. Generates READMEs, documentation, and content efficiently on CPU with minimal resource requirements.

## Overview

The Neural Generator is a lightweight LLM inference service designed for:
- **Local Execution**: No cloud APIs, fully self-hosted
- **Low Resource**: ~400MB model + 512MB runtime (t2.micro compatible)
- **Fast Generation**: 50-100 tokens/sec on 2 vCPUs
- **Scalable**: Async FastAPI handles multiple concurrent requests
- **Privacy**: All data stays local, no external API calls

## Features

- **Local LLM Inference**: Qwen 3 0.6B model on CPU (no GPU needed)
- **Quantized Model**: Q4_K_M format for 10x size reduction (~400MB)
- **Production Ready**: Error handling, timeouts, health checks
- **REST API**: FastAPI with OpenAPI documentation
- **Configurable**: Temperature, top-k, top-p sampling
- **CORS Enabled**: Integrate with multiple frontend domains
- **Async/Concurrent**: Handle multiple generation requests
- **Docker Ready**: Container image included

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | FastAPI 0.100+ | Async web server |
| **LLM Engine** | llama-cpp-python | GGUF model inference |
| **Model** | Qwen 3 0.6B Q4_K_M | Quantized LLM (~400MB) |
| **Async** | asyncio | Concurrent requests |
| **Validation** | Pydantic v2 | Request/response DTOs |
| **HTTP** | uvicorn | ASGI server |

## Quick Start

### Prerequisites

```bash
- Python 3.10+
- 500MB disk space (for model)
- 512MB RAM minimum (1GB recommended)
- CPU (no GPU required)
```

### Installation (3 minutes)

```bash
# Navigate to service directory
cd services/api/neural_generator

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# OR
venv\Scripts\activate              # Windows

# Install dependencies (includes llama-cpp-python)
pip install -r requirements.txt

# Verify installation
python -c "import llama_cpp; print('✓ llama-cpp-python installed')"
```

### Running Locally

```bash
# Start the service
python -m uvicorn src.app:app --host 0.0.0.0 --port 8001

# Or with reload for development
python -m uvicorn src.app:app --host 0.0.0.0 --port 8001 --reload
```

**Service available at:**
- **API:** http://localhost:8001
- **Swagger Docs:** http://localhost:8001/docs
- **ReDoc:** http://localhost:8001/redoc

## API Endpoints

### `POST /generate`

Generate text using the Qwen LLM model.

**Request Body:**

```json
{
  "prompt": "Write a professional README for a Python REST API project",
  "max_tokens": 512,
  "temperature": 0.2,
  "top_k": 40,
  "top_p": 0.9,
  "timeout": 60
}
```

**Parameters:**

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `prompt` | string | required | - | Text to complete/generate from |
| `max_tokens` | int | 512 | 1-2048 | Maximum output tokens |
| `temperature` | float | 0.2 | 0-2.0 | Randomness (0=deterministic, 2=max randomness) |
| `top_k` | int | 40 | 1-100 | Limit to top-k most likely tokens |
| `top_p` | float | 0.9 | 0-1.0 | Nucleus sampling (probability threshold) |
| `timeout` | int | 120 | 1-600 | Request timeout in seconds |

**Response:**

```json
{
  "text": "# Project Title\n\n## Overview\nThis REST API provides...",
  "tokens_generated": 187,
  "generation_time_ms": 3450,
  "model": "Qwen3-0.6B-Q4_K_M"
}
```

### `GET /health`

Check service health and model status.

**Response:**

```json
{
  "status": "healthy",
  "model": "Qwen3-0.6B-Q4_K_M",
  "model_loaded": true,
  "memory_usage_mb": 512,
  "uptime_seconds": 3600
}
```

### `POST /generate/batch`

Generate multiple texts (experimental).

**Request:**

```json
{
  "prompts": [
    "Write a README for project A",
    "Write a README for project B"
  ],
  "max_tokens": 512,
  "temperature": 0.2
}
```

**Response:**

```json
{
  "results": [
    {"text": "...", "tokens_generated": 150},
    {"text": "...", "tokens_generated": 200}
  ],
  "total_time_ms": 5000
}
```

## Usage Examples

### Example 1: Generate README

```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a comprehensive README for a FastAPI-based job crawler. Include features, tech stack, quick start, and usage examples.",
    "max_tokens": 1500,
    "temperature": 0.3
  }'
```

### Example 2: Document Code

```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write detailed docstrings for this Python function:\n\ndef process_jobs(jobs: List[Dict]) -> List[Dict]:\n    # Process and normalize job data",
    "max_tokens": 256,
    "temperature": 0.1
  }'
```

### Example 3: Fix Code Issues

```bash
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Fix this Python code and explain the issue:\n\ndef calculate_sum(a, b)\n    return a+b\n\nFixed code:",
    "max_tokens": 512,
    "temperature": 0.2
  }'
```

### Python Client Example

```python
import requests
import json

BASE_URL = "http://localhost:8001"

def generate_readme(project_description: str) -> str:
    """Generate README using Neural Generator."""
    payload = {
        "prompt": f"Generate a professional README for: {project_description}",
        "max_tokens": 1500,
        "temperature": 0.3
    }
    
    response = requests.post(
        f"{BASE_URL}/generate",
        json=payload,
        timeout=120
    )
    
    if response.status_code == 200:
        return response.json()["text"]
    else:
        raise Exception(f"Generation failed: {response.text}")

# Usage
readme = generate_readme("A FastAPI-based job crawler for 9+ job boards")
print(readme)
```

## Configuration

### Environment Variables

```bash
# Model Configuration
MODEL_PATH=/app/models/qwen3-0.6b-q4_k_m.gguf
LLM_N_THREADS=2                    # CPU threads (1-8, depends on system)
LLM_N_GPU_LAYERS=0                 # GPU layers (keep 0 for CPU-only)
LLM_VERBOSE=false                  # Debug logging

# Server Configuration
HOST=0.0.0.0
PORT=8001

# Request Handling
GENERATION_TIMEOUT=120             # Max seconds per request
MAX_CONCURRENT_REQUESTS=4          # Request queue limit
BATCH_TIMEOUT=300                  # Batch generation timeout

# Performance
CACHE_SIZE=100                     # Number of cached prompts
```

### Creating .env File

```bash
cat > .env << EOF
MODEL_PATH=models/qwen3-0.6b-q4_k_m.gguf
LLM_N_THREADS=2
LLM_VERBOSE=false
HOST=0.0.0.0
PORT=8001
GENERATION_TIMEOUT=120
EOF
```

## Performance Characteristics

### Memory Usage

```
Model (GGUF Q4_K_M): 400MB (fixed)
Runtime Base:        100MB
Per Request:         50-200MB (depends on context size)
────────────────────────────
Total Range:         512-800MB
```

### Generation Speed

```
Cold Start (model load):     2-5 seconds
Warm Start (cached):         <100ms
Generation Speed:            50-100 tokens/sec
Throughput (2 vCPUs):        30-50 tokens/sec total
Max Concurrent Requests:     2-4 (depends on RAM)
```

### Latency

```
Simple prompt (100 tokens):  2-3 seconds
Medium prompt (500 tokens):  10-15 seconds
Large prompt (2000 tokens):  40-60 seconds
Batch of 4:                  50-80 seconds (total)
```

## Project Structure

```
services/api/neural_generator/
├── README.md                          # This file
├── requirements.txt                   # Python dependencies
├── Dockerfile                         # Container image
├── nixpacks.toml                      # Railway deployment
│
├── src/
│   ├── app.py                         # FastAPI application
│   ├── config.py                      # Configuration (Pydantic)
│   ├── models.py                      # Request/response DTOs
│   └── utils.py                       # Helper functions
│
├── models/
│   └── qwen3-0.6b-q4_k_m.gguf        # Quantized model (~400MB)
│
└── tests/
    ├── test_health.py                 # Health check tests
    └── test_generate.py               # Generation tests
```

## Docker Usage

### Build Image

```bash
cd services/api/neural_generator
docker build -t repo-sense-neural-gen:latest .
```

### Run Container

```bash
docker run -d \
  --name neural-gen \
  -p 8001:8001 \
  -e MODEL_PATH=/app/models/qwen3-0.6b-q4_k_m.gguf \
  -e LLM_N_THREADS=2 \
  repo-sense-neural-gen:latest
```

### With Docker Compose

```yaml
neural-generator:
  build: ./services/api/neural_generator
  ports:
    - "8001:8001"
  environment:
    MODEL_PATH: /app/models/qwen3-0.6b-q4_k_m.gguf
    LLM_N_THREADS: 2
    GENERATION_TIMEOUT: 120
  volumes:
    - ./models:/app/models
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
```

## Optimization Tips

### For Low-Memory Environments (t2.micro)

```bash
# Reduce thread usage
LLM_N_THREADS=1

# Reduce batch size
MAX_CONCURRENT_REQUESTS=1

# Lower max tokens
# In API calls, use max_tokens=256
```

### For Better Performance (larger instances)

```bash
# Increase threads
LLM_N_THREADS=4

# Increase concurrent requests
MAX_CONCURRENT_REQUESTS=4

# Allow larger generations
# In API calls, use max_tokens=2048
```

### Caching Prompts

```python
# llama-cpp-python supports prompt caching
# Previously generated sequences are cached
# Calling with similar prompts reuses cache
```

## Testing

```bash
# Check service health
curl http://localhost:8001/health

# Test simple generation
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "max_tokens": 50}'

# Run full test suite
pytest -v
```

## Troubleshooting

### Issue 1: "Model file not found"

**Solution:**
```bash
# Check model path
ls -la models/

# Set correct path
export MODEL_PATH=/full/path/to/model.gguf

# Or update .env
echo "MODEL_PATH=/path/to/model.gguf" >> .env
```

### Issue 2: "Out of memory"

**Solution:**
```bash
# Reduce threads
LLM_N_THREADS=1

# Reduce concurrent requests
MAX_CONCURRENT_REQUESTS=1

# Increase timeout
GENERATION_TIMEOUT=180
```

### Issue 3: "Generation taking too long"

**Solution:**
```bash
# Increase threads (if available)
LLM_N_THREADS=4

# Reduce max_tokens in request
# Use temperature=0.1 for faster deterministic generation
```

### Issue 4: "llama-cpp-python not installing"

**Solution:**
```bash
# Pre-install cmake/gcc (required for compilation)
# Ubuntu/Debian:
sudo apt-get install cmake g++ python3-dev

# macOS:
brew install cmake llama-cpp

# Windows:
# Use pre-built wheels or WSL
pip install llama-cpp-python --only-binary :all:
```

## Scaling

### Single Instance

- Max concurrent: 2-4 requests
- Throughput: 30-50 tokens/sec
- Suitable for: Development, low traffic

### Multiple Instances (Load Balanced)

```bash
# Instance 1 on port 8001
PORT=8001 python -m uvicorn src.app:app

# Instance 2 on port 8002
PORT=8002 python -m uvicorn src.app:app

# Nginx Load Balancer
upstream neural_gen {
  server localhost:8001;
  server localhost:8002;
}

server {
  listen 80;
  location / {
    proxy_pass http://neural_gen;
  }
}
```

## Related Services

- **Main API:** [services/api/README.md](../README.md)
- **RAG Service:** [services/api/rag/README.md](../rag/README.md)
- **Backend:** [services/README.md](../../README.md)

---

**For deployment:** See [docs/DEPLOYMENT_GUIDE.md](../../../../docs/DEPLOYMENT_GUIDE.md)
```

##  Docker

### Build

```bash
docker build -t neural-generator:latest .
```

### Run

```bash
docker run -d \
  --name neural-gen \
  -p 8001:8001 \
  -e MODEL_PATH=/app/models/Qwen3-0_6B-Q4_K_M.gguf \
  -e LLM_N_THREADS=2 \
  -v $(pwd)/models:/app/models \
  --memory=1024m \
  neural-generator:latest
```

### Docker Compose

```yaml
neural-generator:
  build: ./services/api/neural-generator
  ports:
    - "8001:8001"
  environment:
    MODEL_PATH: /app/models/Qwen3-0_6B-Q4_K_M.gguf
    LLM_N_THREADS: 2
  volumes:
    - ./services/api/neural-generator/models:/app/models
  mem_limit: 1024m
```

##  Usage Examples

### Generate README

```python
import httpx
import asyncio

async def generate_readme():
    prompt = """Generate a professional README for a Python project:
    - Name: DataProcessor
    - Purpose: Process CSV files and generate reports
    - Tech: Python, FastAPI, PostgreSQL"""
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8001/generate",
            json={
                "prompt": prompt,
                "max_tokens": 1500,
                "temperature": 0.2
            },
            timeout=120.0
        )
        return response.json()

# Run
readme = asyncio.run(generate_readme())
print(readme["text"])
```

### Integration with RAG

```python
# In RAG service
async def generate_with_context(repo_files):
    # Create prompt with file names and snippets
    prompt = f"""Based on these repository files:
    {repo_files}
    
    Generate a comprehensive README.md"""
    
    response = await client.post(
        "http://neural-generator:8001/generate",
        json={"prompt": prompt, "max_tokens": 2000}
    )
    return response.json()["text"]
```

## Troubleshooting

### Model not found

```bash
# Check model exists
ls -la models/Qwen3-0_6B-Q4_K_M.gguf

# Download if missing (3.5GB)
# From HuggingFace: https://huggingface.co/TheBloke/Qwen-0.5B-Chat-GGUF
```

### Out of memory

```bash
# Reduce threads
export LLM_N_THREADS=1

# Reduce max tokens per request
# Reduce temperature (uses less memory)

# Check RAM usage
free -h  # Linux
wmic OS get TotalVisibleMemorySize  # Windows
```

### Slow generation

```bash
# Increase threads (if available)
export LLM_N_THREADS=4

# Use GPU (if available)
export LLM_N_GPU_LAYERS=10

# Reduce max_tokens in requests
# Use higher temperature (faster but less coherent)
```

### CORS errors

```python
# Already handled in app.py with:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
```

##  Monitoring

### Health Check

```bash
curl http://localhost:8001/health
# Response: {"status": "ok", "model_loaded": true}
```

### Request Logging

```python
# In app.py, add middleware for logging
@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    # Log: {path} {status} {duration}s
    return response
```

##  Deployment

### Railway.app

```bash
# Push service
railway up

# View logs
railway logs

# Monitor
railway status
```

### AWS Lambda (with layers)

```bash
# Create deployment package
pip install -r requirements.txt -t package/
zip -r lambda.zip package/

# Upload to Lambda
# Set timeout: 300s (5 min)
# Set memory: 1024MB
```

### Traditional VPS

```bash
# Systemd service
sudo tee /etc/systemd/system/neural-gen.service << EOF
[Unit]
Description=Neural Generator
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/neural-generator
ExecStart=/usr/bin/python3 -m uvicorn src.app:app --host 0.0.0.0 --port 8001
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl start neural-gen
sudo systemctl status neural-gen
```

##  Related Services

- **Main API**: [services/README.md](../README.md)
- **RAG Service**: [services/api/rag/README.md](../rag/README.md)
- **Crawler**: [services/api/crawler/README.md](../crawler/README.md)

##  Support

1. Check logs: `docker logs neural-gen`
2. Test endpoint: `curl http://localhost:8001/health`
3. Verify model: `ls -la models/`
4. Check RAM: `free -h` or `top`

