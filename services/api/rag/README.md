# rag — RAG Documentation Service

A small FastAPI microservice that indexes text documents into a local vector
store and answers questions against them using retrieval-augmented
generation. Used by the core API for repo/documentation-aware AI features.

## Structure

```
src/
  app.py             FastAPI app + /health endpoint
  routes.py           /index and /generate endpoints
  config.py            Service configuration
  models/schemas.py    Request/response models
  services/
    chunker.py           Splits documents into embeddable chunks
    embedder.py           Generates embeddings (sentence-transformers)
    vector_store.py        FAISS-backed vector index
    generator.py           Builds prompts from retrieved chunks and calls the LLM
```

## Running locally

```bash
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8001
```

Or via Docker: `docker build -t reposense-rag . && docker run -p 8001:8001 reposense-rag`.

## Endpoints

- `POST /index` — chunk, embed, and store a document in the vector index
- `POST /generate` — retrieve relevant chunks for a query and generate an
  answer
- `GET /health` — liveness check

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VECTOR_STORE_PATH` | `/app/data/faiss_index` | Where the FAISS index is persisted |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | sentence-transformers model used for embeddings |
| `LLM_ENDPOINT` | `http://neural-generator:8002/generate` | Endpoint of the neural-generator service used to produce answers |

The core API reaches this service via its own `RAG_SERVICE_URL` environment
variable (default `http://localhost:8001`).
