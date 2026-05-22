#  RAG (Retrieval-Augmented Generation) Service

FastAPI microservice for intelligent documentation generation using Retrieval-Augmented Generation (RAG). Indexes repository files, creates semantic embeddings with FAISS, and generates accurate READMEs using context from the codebase.

##  What is RAG?

**Retrieval-Augmented Generation** combines:
1. **Retrieval**: Search indexed documents using semantic similarity
2. **Augmentation**: Add retrieved context to LLM prompt
3. **Generation**: LLM generates response based on context

**Advantage**: More accurate, sourced-based outputs vs. pure hallucination-prone LLM

## Features

- **Repository Indexing**: Process GitHub/local repos into embeddings
- **FAISS Vector Store**: Fast semantic search on embeddings
- **Multi-File Support**: Index multiple file types (.py, .ts, .md, etc)
- **README Generation**: Auto-generate comprehensive READMEs with code context
- **Search API**: Query indexed files by semantic similarity
- **Chunking**: Split large files for better context retrieval
- **Persistence**: Save/load FAISS indices to disk
- **Integration**: Works with Neural Generator service

## Tech Stack

- **Framework**: FastAPI
- **Vector DB**: FAISS (Meta's similarity search library)
- **Embeddings**: sentence-transformers (all-MiniLM-L6-v2)
- **Text Processing**: nltk, regex
- **LLM Client**: httpx (async HTTP for Neural Generator)
- **Persistence**: Pickle for metadata

##  Project Structure

```
services/api/rag/
├── src/
│   ├── app.py                      # FastAPI app & routes
│   ├── services/
│   │   ├── generator.py            # LLM integration (Neural Gen)
│   │   ├── vector_store.py         # FAISS management
│   │   └── indexer.py              # File processing & embedding
│   └── schemas/
│       └── models.py               # Pydantic models
├── indices/                         # FAISS indices (persisted)
│   ├── index.faiss
│   └── metadata.pkl
├── requirements.txt
├── Dockerfile
├── README.md                       # This file
└── nixpacks.toml
```

##  Quick Start

### Prerequisites

```bash
- Python 3.10+
- 500MB disk (for FAISS indices)
- 1GB RAM (for embeddings)
- Neural Generator service running (optional)
```

### Installation

```bash
# Navigate to service
cd services/api/rag

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Download embedding model (first run, ~100MB)
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

### Running Locally

```bash
# Without Neural Generator (search-only mode)
python -m uvicorn src.app:app --host 0.0.0.0 --port 8002 --reload

# With Neural Generator
export NEURAL_GENERATOR_URL=http://localhost:8001
python -m uvicorn src.app:app --host 0.0.0.0 --port 8002 --reload
```

**Service available at:** http://localhost:8002  
**Docs:** http://localhost:8002/docs

##  API Endpoints

### POST `/api/rag/index`

Index repository files into FAISS vector store.

**Request:**

```json
{
  "repo_url": "https://github.com/user/project",
  "local_path": "/path/to/repo",
  "file_extensions": [".py", ".ts", ".md"]
}
```

**Response:**

```json
{
  "status": "success",
  "files_indexed": 42,
  "chunks_created": 156,
  "index_saved": true
}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `repo_url` | string | null | GitHub URL (cloned automatically) |
| `local_path` | string | null | Local path (if repo already cloned) |
| `file_extensions` | array | [".py", ".ts", ".md", ".js"] | File types to process |
| `chunk_size` | int | 512 | Tokens per chunk |
| `chunk_overlap` | int | 50 | Tokens between chunks |

### POST `/api/rag/generate`

Generate README using context from indexed files.

**Request:**

```json
{
  "prompt": "Generate a comprehensive README for this project",
  "max_tokens": 2000,
  "include_sections": [
    "Overview",
    "Installation",
    "Quick Start",
    "Architecture",
    "API Reference"
  ]
}
```

**Response:**

```json
{
  "readme": "# Project Name\n\n## Overview\n...",
  "source_files": ["main.py", "config.ts", "README.md"],
  "similarity_scores": [0.89, 0.76, 0.82]
}
```

### POST `/api/rag/search`

Search indexed files by semantic similarity.

**Request:**

```json
{
  "query": "How does authentication work?",
  "top_k": 5,
  "threshold": 0.5
}
```

**Response:**

```json
{
  "results": [
    {
      "file": "auth.py",
      "chunk": "def verify_token(token: str):\n...",
      "similarity": 0.87,
      "line_start": 45,
      "line_end": 62
    }
  ]
}
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search text |
| `top_k` | int | 5 | Number of results |
| `threshold` | float | 0.5 | Minimum similarity (0-1) |

### GET `/api/rag/indices`

List available FAISS indices.

**Response:**

```json
{
  "indices": [
    {
      "name": "repo-sense",
      "created": "2024-01-15T10:30:00Z",
      "files": 42,
      "chunks": 156
    }
  ]
}
```

### DELETE `/api/rag/indices/{index_name}`

Delete an index.

**Response:**

```json
{
  "status": "deleted",
  "index": "repo-sense"
}
```

### GET `/api/rag/health`

Health check.

**Response:**

```json
{
  "status": "ok",
  "model_loaded": true,
  "indices_available": 3
}
```

## Environment Variables

```bash
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