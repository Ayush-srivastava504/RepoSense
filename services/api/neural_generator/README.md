# Neural Generator Service

FastAPI microservice for AI-powered text generation using **Qwen GGUF** model via **llama-cpp-python**. Generates documentation, READMEs, and other content efficiently on CPU with minimal memory footprint.

## Features

- **Local LLM Inference**: Run Qwen 3 0.6B model on CPU
- **Quantized Model**: Q4_K_M format (~400MB)
- **Low Memory**: 512-1024MB runtime (t2.micro friendly)
- **Fast Generation**: ~50-100 tokens/sec on 2 vCPUs
- **Configurable Parameters**: Temperature, top-k, top-p control
- **Health Checks**: Monitoring and status endpoints
- **CORS Enabled**: Integrate with multiple frontend domains

## Tech Stack

- **Framework**: FastAPI
- **LLM**: llama-cpp-python (GGUF)
- **Model**: Qwen3-0.6B-Q4_K_M
- **Async**: asyncio for concurrent requests
- **Validation**: Pydantic

## Project Structure

```
services/api/neural-generator/
├── src/
│   ├── app.py                      # FastAPI application
├── models/
│   └── Qwen3-0_6B-Q4_K_M.gguf     # Quantized model (~400MB)
├── requirements.txt                # Dependencies
├── Dockerfile                      # Container config
├── README.md                       # This file
└── nixpacks.toml                   # Railway deployment
```

## Quick Start

### Prerequisites

```bash
- Python 3.10+
- 500MB disk (model)
- 1GB RAM minimum (512MB preferred for container)
```

### Installation

```bash
# Navigate to service
cd services/api/neural-generator

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Verify installation
python -c "import llama_cpp; print('✓ llama-cpp-python installed')"
```

### Running Locally

```bash
# Set model path
export MODEL_PATH=models/Qwen3-0_6B-Q4_K_M.gguf

# Or on Windows:
set MODEL_PATH=models\Qwen3-0_6B-Q4_K_M.gguf

# Start server
python -m uvicorn src.app:app --host 0.0.0.0 --port 8001 --reload
```

**Service available at:** http://localhost:8001  
**Docs:** http://localhost:8001/docs

##  API Endpoints

### POST `/generate`

Generate text using the model.

**Request:**

```json
{
  "prompt": "Generate a README for a Python project that...",
  "max_tokens": 512,
  "temperature": 0.2,
  "top_k": 40,
  "top_p": 0.9
}
```

**Response:**

```json
{
  "text": "# Project Name\n\n## Description\n..."
}
```

**Parameters:**

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `prompt` | string | required | - | Text to complete |
| `max_tokens` | int | 512 | 1-2048 | Max output length |
| `temperature` | float | 0.2 | 0-2.0 | Randomness (0=deterministic) |
| `top_k` | int | 40 | 1-100 | Limit to top-k tokens |
| `top_p` | float | 0.9 | 0-1.0 | Nucleus sampling threshold |

**Examples:**

```bash
# Generate README
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a professional README for a Python REST API",
    "max_tokens": 1500,
    "temperature": 0.2
  }'

# Generate code documentation
curl -X POST http://localhost:8001/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate docstrings for this Python function: def calculate_sum(a, b):",
    "max_tokens": 256,
    "temperature": 0.1
  }'
```

### GET `/health`

Check service health.

**Response:**

```json
{
  "status": "ok",
  "model": "Qwen3-0.6B-Q4_K_M",
  "model_loaded": true
}
```

##  Environment Variables

```bash
# Model path (required)
MODEL_PATH=/app/models/qwen3-codersmall-0.8b-q4_k_m.gguf

# LLM Parameters (optional)
LLM_N_THREADS=2                    # CPU threads (reduce for low-memory)
LLM_N_GPU_LAYERS=0                 # GPU layers (keep 0 for CPU-only)
LLM_VERBOSE=false                  # Debug logging

# Server
HOST=0.0.0.0
PORT=8001

# Timeout
GENERATION_TIMEOUT=120             # Max seconds per request
```

##  Performance

### Memory Usage

```
Model (GGUF): 400MB
Runtime Base: 100MB
Per Request: 50-200MB (depends on context)
Total: ~512-800MB
```

### Speed

```
Cold Start: 2-5 seconds (load model)
Generation: 50-100 tokens/second (on 1 vCPU)
Max Concurrent: 2-4 requests (depends on RAM)
```

### Optimization Tips

```python
# Reduce for low-memory environments
n_threads=1              # Instead of 2
n_gpu_layers=0           # Keep CPU-only
max_tokens=256           # Smaller outputs

# Increase for better performance
n_threads=4              # More CPU cores
batch_size=2             # Not yet implemented
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

