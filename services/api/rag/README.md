#  RAG (Retrieval-Augmented Generation) Service

> FastAPI microservice for intelligent context-aware documentation generation. Indexes repository files, creates semantic embeddings, and generates accurate READMEs using FAISS vector similarity search combined with local LLM inference.

## Overview

The RAG Service combines **semantic search** and **context-aware generation** to:
- **Index repository code** into semantic embeddings
- **Search** similar code snippets by meaning (not just keywords)
- **Generate documentation** with context from the actual codebase
- **Avoid hallucinations** by grounding LLM responses in real code

## What is RAG?

**Retrieval-Augmented Generation** is a 3-step process:

```
1. RETRIEVAL
   Question: "What authentication methods are supported?"
   ↓
   Search indexed embeddings for relevant code
   ↓
   Return top 5 matching code chunks

2. AUGMENTATION
   Take retrieved chunks and prepend to LLM prompt
   ↓
   "Based on this code: <code chunks>
    Please answer: What authentication methods are supported?"

3. GENERATION
   LLM generates answer grounded in actual code
   ↓
   "The project supports JWT, OAuth 2.0, and GitHub authentication..."
```

**Advantage vs. Pure LLM:** Responses are factual and sourced from actual code, not hallucinated.

## Features

- **Repository Indexing**: Process GitHub/local repos into embeddings
- **Semantic Search**: FAISS vector similarity search (~100x faster than linear)
- **Multi-File Support**: Python, TypeScript, Go, Java, Markdown, etc.
- **Smart Chunking**: Split large files for better context retrieval
- **README Generation**: Auto-generate comprehensive READMEs from code
- **Persistence**: Save/load FAISS indices to disk
- **Async API**: FastAPI with concurrent request handling
- **LLM Integration**: Works with Neural Generator service
- **Configurable**: Chunk size, overlap, similarity threshold

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | FastAPI 0.100+ | Async web server |
| **Vector DB** | FAISS | Million-scale similarity search |
| **Embeddings** | sentence-transformers | all-MiniLM-L6-v2 model (~100MB) |
| **Text** | nltk, regex | Tokenization & chunking |
| **LLM** | httpx (async) | Call Neural Generator service |
| **Async** | asyncio | Concurrent indexing |
| **Storage** | Pickle | Persist indices & metadata |

## Quick Start

### Prerequisites

```bash
- Python 3.10+
- 500MB disk (for FAISS indices)
- 1GB RAM (for embeddings)
- Optional: Neural Generator service (for generation)
```

### Installation (3 minutes)

```bash
# Navigate to service
cd services/api/rag

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# OR
venv\Scripts\activate              # Windows

# Install dependencies
pip install -r requirements.txt

# Download embedding model (one-time, ~100MB)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Create indices directory
mkdir -p indices
```

### Running

```bash
# Start RAG service (Port 8002)
python -m uvicorn src.app:app --host 0.0.0.0 --port 8002

# With Neural Generator integration
export NEURAL_GENERATOR_URL=http://localhost:8001
python -m uvicorn src.app:app --host 0.0.0.0 --port 8002

# Development mode with reload
python -m uvicorn src.app:app --port 8002 --reload
```

**Service available at:**
- **API:** http://localhost:8002
- **Swagger Docs:** http://localhost:8002/docs
- **ReDoc:** http://localhost:8002/redoc

## API Endpoints

### `POST /api/rag/index`

Index a repository into FAISS vector store.

**Request Body:**

```json
{
  "index_name": "my-project",
  "repo_url": "https://github.com/user/my-project",
  "file_extensions": [".py", ".ts", ".md", ".js"],
  "chunk_size": 512,
  "chunk_overlap": 50
}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `index_name` | string | required | Name for this index |
| `repo_url` | string | null | GitHub URL (auto-cloned) |
| `local_path` | string | null | Local path (if repo exists) |
| `file_extensions` | array | [".py", ".ts", ".md"] | File types to index |
| `chunk_size` | int | 512 | Tokens per chunk |
| `chunk_overlap` | int | 50 | Overlap between chunks |

**Response:**

```json
{
  "status": "success",
  "index_name": "my-project",
  "files_indexed": 42,
  "chunks_created": 156,
  "index_size_mb": 45,
  "indexing_time_sec": 23.5
}
```

### `POST /api/rag/search`

Search indexed files by semantic similarity.

**Request Body:**

```json
{
  "index_name": "my-project",
  "query": "How does authentication work?",
  "top_k": 5,
  "threshold": 0.5
}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `index_name` | string | required | Which index to search |
| `query` | string | required | Search query |
| `top_k` | int | 5 | Number of results |
| `threshold` | float | 0.5 | Min similarity (0-1) |

**Response:**

```json
{
  "query": "How does authentication work?",
  "results": [
    {
      "file": "src/auth.py",
      "chunk": "def verify_jwt_token(token: str):\n    \"\"\"Verify JWT token signature.\"\"\"\n    try:\n        payload = jwt.decode(token, SECRET_KEY)\n        return payload['user_id']\n    except jwt.InvalidTokenError:\n        return None",
      "similarity": 0.92,
      "line_start": 45,
      "line_end": 53
    },
    {
      "file": "src/middleware/auth.py",
      "chunk": "async def authenticate_user(request):\n    token = request.headers.get('Authorization')\n    if not token:\n        raise HTTPException(status_code=401)\n    return verify_jwt_token(token)",
      "similarity": 0.87,
      "line_start": 12,
      "line_end": 17
    }
  ]
}
```

### `POST /api/rag/generate`

Generate README using context from indexed files.

**Request Body:**

```json
{
  "index_name": "my-project",
  "prompt": "Generate a professional README",
  "max_tokens": 2000,
  "sections": ["Overview", "Installation", "Usage", "API"]
}
```

**Response:**

```json
{
  "readme": "# My Project\n\n## Overview\nBased on the codebase...\n\n## Installation\n...",
  "source_chunks": [
    {"file": "main.py", "lines": "1-50"},
    {"file": "config.py", "lines": "1-30"}
  ],
  "generation_time_sec": 12.3,
  "tokens_generated": 1456
}
```

### `GET /api/rag/indices`

List all available indices.

**Response:**

```json
{
  "indices": [
    {
      "name": "my-project",
      "created_at": "2024-01-15T10:30:00Z",
      "files": 42,
      "chunks": 156,
      "size_mb": 45
    },
    {
      "name": "another-project",
      "created_at": "2024-01-14T15:45:00Z",
      "files": 28,
      "chunks": 95,
      "size_mb": 32
    }
  ]
}
```

### `GET /api/rag/indices/{index_name}`

Get details about a specific index.

**Response:**

```json
{
  "name": "my-project",
  "created_at": "2024-01-15T10:30:00Z",
  "files": [
    {"name": "src/main.py", "chunks": 15},
    {"name": "src/auth.py", "chunks": 8},
    {"name": "README.md", "chunks": 3}
  ],
  "total_chunks": 156,
  "embedding_model": "all-MiniLM-L6-v2",
  "index_size_mb": 45
}
```

### `DELETE /api/rag/indices/{index_name}`

Delete an index.

**Response:**

```json
{
  "status": "deleted",
  "index": "my-project"
}
```

### `GET /api/rag/health`

Health check.

**Response:**

```json
{
  "status": "healthy",
  "embedding_model_loaded": true,
  "indices_available": 2,
  "faiss_version": "1.7.4"
}
```

## Usage Examples

### Example 1: Index a Repository

```bash
curl -X POST http://localhost:8002/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{
    "index_name": "repo-sense",
    "repo_url": "https://github.com/yourusername/repo-sense",
    "file_extensions": [".py", ".ts", ".md"],
    "chunk_size": 512
  }'
```

### Example 2: Search Code

```bash
curl -X POST http://localhost:8002/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{
    "index_name": "repo-sense",
    "query": "How are jobs scraped from websites?",
    "top_k": 3
  }'
```

### Example 3: Generate README

```bash
curl -X POST http://localhost:8002/api/rag/generate \
  -H "Content-Type: application/json" \
  -d '{
    "index_name": "repo-sense",
    "prompt": "Generate a detailed README for the RepoSense project",
    "max_tokens": 2000,
    "sections": ["Overview", "Features", "Architecture", "Installation", "Usage"]
  }'
```

### Python Client Example

```python
import requests

BASE_URL = "http://localhost:8002"

# Index a repository
index_response = requests.post(
    f"{BASE_URL}/api/rag/index",
    json={
        "index_name": "my-project",
        "repo_url": "https://github.com/user/my-project",
        "file_extensions": [".py", ".md"]
    }
)
print(index_response.json())

# Search the index
search_response = requests.post(
    f"{BASE_URL}/api/rag/search",
    json={
        "index_name": "my-project",
        "query": "How does authentication work?",
        "top_k": 5
    }
)
print(search_response.json())

# Generate README
readme_response = requests.post(
    f"{BASE_URL}/api/rag/generate",
    json={
        "index_name": "my-project",
        "prompt": "Generate a professional README",
        "max_tokens": 1500
    }
)
print(readme_response.json()["readme"])
```

## Configuration

### Environment Variables

```bash
# Embedding Model
EMBEDDING_MODEL=all-MiniLM-L6-v2    # sentence-transformers model
MODEL_CACHE_DIR=.model_cache         # Where to cache downloaded models

# FAISS
FAISS_FACTORY=IVF100,Flat           # Index type (optional)
INDEX_DIR=./indices                 # Where to save indices

# LLM Integration
NEURAL_GENERATOR_URL=http://localhost:8001
LLM_TIMEOUT=120                     # Timeout for LLM requests

# Server
HOST=0.0.0.0
PORT=8002

# Processing
CHUNK_SIZE=512                      # Tokens per chunk
CHUNK_OVERLAP=50                    # Tokens between chunks
MAX_FILE_SIZE=1000000               # Max file size in bytes
```

### Creating .env

```bash
cat > .env << EOF
EMBEDDING_MODEL=all-MiniLM-L6-v2
INDEX_DIR=./indices
NEURAL_GENERATOR_URL=http://localhost:8001
CHUNK_SIZE=512
EOF
```

## Performance

### Indexing Speed

```
Initial model load: 5-10 seconds
Per file processing: 0.1-0.5 seconds (depends on size)
Repository with 50 files: 30-60 seconds
```

### Search Speed

```
Query embedding creation: 100-200ms
FAISS similarity search (1000 chunks): 1-5ms
Top-5 retrieval: <50ms total
```

### Memory Usage

```
Embedding model: ~100MB
Per index (1000 chunks): ~50MB
Total for 2 indices: ~200-250MB
```

## Project Structure

```
services/api/rag/
├── README.md                          # This file
├── requirements.txt                   # Dependencies
├── Dockerfile                         # Container image
├── nixpacks.toml                      # Railway deployment
│
├── src/
│   ├── app.py                         # FastAPI application
│   ├── config.py                      # Configuration
│   ├── models.py                      # Request/response DTOs
│   │
│   └── services/
│       ├── embedder.py                # Sentence-transformers
│       ├── vector_store.py            # FAISS management
│       ├── indexer.py                 # File processing
│       └── generator.py               # Neural Gen integration
│
├── indices/
│   ├── my-project.faiss              # Index file
│   └── my-project_meta.pkl           # Metadata
│
└── tests/
    ├── test_indexing.py
    └── test_search.py
```

## Docker

### Build

```bash
cd services/api/rag
docker build -t repo-sense-rag:latest .
```

### Run

```bash
docker run -d \
  --name rag \
  -p 8002:8002 \
  -e NEURAL_GENERATOR_URL=http://neural-gen:8001 \
  -v ./indices:/app/indices \
  repo-sense-rag:latest
```

### With Docker Compose

```yaml
rag:
  build: ./services/api/rag
  ports:
    - "8002:8002"
  environment:
    NEURAL_GENERATOR_URL: http://neural-generator:8001
    INDEX_DIR: /app/indices
    CHUNK_SIZE: 512
  volumes:
    - ./indices:/app/indices
  depends_on:
    - neural-generator
```

## Testing

```bash
# Health check
curl http://localhost:8002/api/rag/health

# Index a test repo
curl -X POST http://localhost:8002/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{"index_name": "test", "local_path": ".", "file_extensions": [".py"]}'

# Search
curl -X POST http://localhost:8002/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"index_name": "test", "query": "test", "top_k": 3}'

# Run tests
pytest -v
```

## Troubleshooting

### Issue 1: "Model not found"

```bash
# Download model manually
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Or set cache directory
export SENTENCE_TRANSFORMERS_HOME=/path/to/models
```

### Issue 2: "Indices directory not writable"

```bash
mkdir -p ./indices
chmod 755 ./indices
```

### Issue 3: "Out of memory during indexing"

```bash
# Reduce chunk size
export CHUNK_SIZE=256

# Or index files separately
# Index one file type at a time
```

### Issue 4: "LLM not generating"

```bash
# Ensure Neural Generator is running
curl http://localhost:8001/health

# Or set URL to skip generation
# Use search-only mode
```

## Related Services

- **Main API:** [services/api/README.md](../README.md)
- **Neural Generator:** [services/api/neural_generator/README.md](../neural_generator/README.md)
- **Backend:** [services/README.md](../../README.md)

---

**For deployment:** See [docs/DEPLOYMENT_GUIDE.md](../../../../docs/DEPLOYMENT_GUIDE.md)
# Neural Generator integration
NEURAL_GENERATOR_URL=http://localhost:8001

# Embedding model
EMBEDDING_MODEL=all-MiniLM-L6-v2                    # Fast, lightweight

# Chunking
CHUNK_SIZE=512                                       # Tokens per chunk
CHUNK_OVERLAP=50                                     # Overlap for context

# FAISS
FAISS_INDEX_DIR=./indices                           # Where to save indices
MAX_RETRIEVAL_CONTEXT=2000                          # Max tokens to retrieve

# API
HOST=0.0.0.0
PORT=8002
TIMEOUT=300                                          # Request timeout (seconds)
```

## RAG Pipeline Flow

```
Input Repository
    ↓
1. FILE READING
   ├─ Clone repo / read local
   ├─ Filter by extension
   └─ Extract text content
    ↓
2. CHUNKING
   ├─ Split files into chunks (512 tokens)
   ├─ Maintain overlap (50 tokens)
   └─ Track source location
    ↓
3. EMBEDDING
   ├─ Convert text → vectors (384-dim)
   ├─ Using: all-MiniLM-L6-v2
   └─ Store in FAISS
    ↓
4. INDEXING
   ├─ Create FAISS index
   ├─ Save to disk (index.faiss)
   └─ Save metadata (metadata.pkl)
    ↓
5. RETRIEVAL
   ├─ User query → vector
   ├─ Search FAISS
   └─ Get top-k similar chunks
    ↓
6. GENERATION
   ├─ Build context from chunks
   ├─ Create prompt with context
   └─ Send to Neural Generator
    ↓
Generated README
```

## Performance

### Indexing Speed

```
~1000 files: 2-5 minutes
~5000 chunks: FAISS index creation ~1 second
Storage: ~100MB for 5000 chunks (384-dim vectors)
```

### Search Latency

```
Query processing: 10-50ms
FAISS similarity search: 5-20ms
Total per-query: ~50-100ms
```

### Memory Usage

```
Embedding model: ~100MB
FAISS index (5000 chunks): ~150MB
Per-query: ~50MB (temporary)
Total: ~300MB baseline
```

## Usage Examples

### Index a Repository

```python
import httpx
import asyncio

async def index_repo():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8002/api/rag/index",
            json={
                "repo_url": "https://github.com/user/my-project",
                "file_extensions": [".py", ".ts", ".md"],
                "chunk_size": 512
            },
            timeout=600.0
        )
        return response.json()

result = asyncio.run(index_repo())
print(f"Indexed {result['files_indexed']} files, {result['chunks_created']} chunks")
```

### Search Indexed Files

```python
async def search_code():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8002/api/rag/search",
            json={
                "query": "How does the authentication system work?",
                "top_k": 3
            }
        )
        results = response.json()["results"]
        for result in results:
            print(f"{result['file']} (similarity: {result['similarity']:.2f})")
            print(result['chunk'][:200])

asyncio.run(search_code())
```

### Generate README

```python
async def generate_readme():
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8002/api/rag/generate",
            json={
                "prompt": "Write a professional README",
                "max_tokens": 2000,
                "include_sections": [
                    "Overview",
                    "Installation",
                    "Quick Start",
                    "API"
                ]
            },
            timeout=300.0
        )
        readme = response.json()["readme"]
        print(readme)

asyncio.run(generate_readme())
```

## Docker

### Build

```bash
docker build -t rag-service:latest .
```

### Run

```bash
docker run -d \
  --name rag-service \
  -p 8002:8002 \
  -e NEURAL_GENERATOR_URL=http://neural-generator:8001 \
  -v $(pwd)/indices:/app/indices \
  --memory=1024m \
  rag-service:latest
```

### Docker Compose

```yaml
rag-service:
  build: ./services/api/rag
  ports:
    - "8002:8002"
  environment:
    NEURAL_GENERATOR_URL: http://neural-generator:8001
    CHUNK_SIZE: 512
  volumes:
    - ./indices:/app/indices
  mem_limit: 1024m
  depends_on:
    - neural-generator
```

## Troubleshooting

### Model Download Hangs

```bash
# Download embedding model manually
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Check cache
ls ~/.cache/huggingface/
```

### FAISS Index Corrupted

```bash
# Remove and rebuild
rm -rf indices/
mkdir indices/

# Re-index repository
curl -X POST http://localhost:8002/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"..."}'
```

### Poor Search Results

```bash
# Increase chunk overlap for better context
export CHUNK_OVERLAP=100

# Use larger embedding model
export EMBEDDING_MODEL=all-mpnet-base-v2

# Lower similarity threshold
POST /api/rag/search with "threshold": 0.3
```

### Neural Generator Not Reachable

```bash
# Fallback to search-only mode
# API will return search results without generation

# Or specify generator URL
export NEURAL_GENERATOR_URL=http://localhost:8001
```

## Monitoring

### Index Health

```bash
curl http://localhost:8002/api/rag/health
```

### List Indices

```bash
curl http://localhost:8002/api/rag/indices
```

### Index Size

```bash
du -sh indices/
ls -lh indices/*.faiss
```

## Deployment

### Railway.app

```bash
railway up
```

### Docker Swarm

```bash
docker service create \
  --name rag-service \
  -p 8002:8002 \
  --env NEURAL_GENERATOR_URL=http://neural-generator:8001 \
  rag-service:latest
```

## Performance Tuning

| Issue | Solution |
|-------|----------|
| Slow indexing | Reduce chunk_size, increase chunk_overlap |
| Poor search results | Lower threshold, use larger embedding model |
| High memory | Limit chunks per index, use smaller model |
| Slow generation | Use smaller max_tokens, lower max_retrieval_context |

## Related Services

- **Main API**: [services/README.md](../README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](../neural-generator/README.md)
- **Crawler**: [services/api/crawler/README.md](../crawler/README.md)

##  License

Part of Repo Sense project
```

## Endpoints
- `GET /health`: Health check endpoint.
- `GET /docs`: Swagger UI for API documentation.

## Development
- Add new routes in `src/routes.py`.
- Use `src/models/` for data models.

## Testing
Run tests with:
```bash
pytest
```