# RepoSense RAG Service

> FastAPI microservice that indexes repository code into a FAISS vector store and generates context-grounded READMEs by retrieving relevant chunks and asking the Neural Generator to write from them. Runs on **port 8001**.

## Overview

Two endpoints, both under `/api/rag`:

```
POST /api/rag/index      — chunk + embed a set of files, add them to the FAISS index
POST /api/rag/generate   — retrieve relevant chunks for a prompt, ask the LLM to write a README from them
GET  /health              — {"status": "ok"}
```

There is no `/api/rag/search` or standalone retrieval-only endpoint — retrieval only happens as a step inside `/generate`.

## How it actually works

```
POST /api/rag/index
  { repo_name, files: [{ path, content }, ...] }
    ↓
CodeChunker.chunk_file() — splits each file into ~1500-char chunks on line
boundaries (services/chunker.py), tagged with path + starting line number
    ↓
Embedder (sentence-transformers, singleton) — embeds all chunk texts
    ↓
VectorStore.add() + .save() — appends to an in-memory FAISS IndexFlatIP,
then persists the whole index + a pickled metadata list to disk

POST /api/rag/generate
  { repo_name, prompt }
    ↓
Embed the prompt, VectorStore.search() — top-10 nearest chunks by inner product
    ↓
Build a context string: "File: <path>\n```\n<chunk text>\n```" per result, joined
    ↓
Generator.generate() — POSTs { prompt: <wrapped prompt + context>, max_tokens: 1500 }
to LLM_ENDPOINT (the Neural Generator's /generate)
    ↓
Return { readme: <generated text>, used_chunks: <count> }
```

**Important gap:** `repo_name` is accepted in both request schemas but is **not used to scope the index or the search** — `VectorStore` is a single global FAISS index shared across every call to `/index`, and `/generate`'s search isn't filtered by `repo_name` at all. If you index two different repos, `/generate` will retrieve chunks from whichever one is most semantically similar to the prompt, not necessarily the one you asked about. If you need per-repo isolation, that's a gap to fill (e.g. a separate `VectorStore` per `repo_name`, or storing `repo_name` in the chunk metadata and filtering search results by it), not an existing feature.

## Components

| File | Responsibility |
|---|---|
| `src/app.py` | FastAPI app, CORS, mounts the router, `/health` |
| `src/routes.py` | The two endpoints; lazily instantiates `Embedder`/`VectorStore` as module-level singletons on first request |
| `src/services/chunker.py` | `CodeChunker.chunk_file()` — line-boundary chunking, default `max_chars=1500` |
| `src/services/embedder.py` | `Embedder` — singleton wrapping `SentenceTransformer(EMBEDDING_MODEL, device="cpu")`, normalizes embeddings |
| `src/services/vector_store.py` | `VectorStore` — `faiss.IndexFlatIP` (dimension 384, i.e. sized for `all-MiniLM-L6-v2` specifically — changing `EMBEDDING_MODEL` to a model with a different output dimension will break this unless the constant is also updated) + pickled metadata, persisted to `VECTOR_STORE_PATH` |
| `src/services/generator.py` | `Generator.generate()` — builds the README-generation prompt and calls `LLM_ENDPOINT` with a 120s timeout |
| `src/models/schemas.py` | `FileContent`, `IndexRequest`, `GenerateRequest`, `GenerateResponse` Pydantic models |
| `src/config.py` | Reads `VECTOR_STORE_PATH`, `EMBEDDING_MODEL`, `LLM_ENDPOINT` from env, with `load_dotenv()` |

`VectorStore.load()` only loads from disk if **both** the FAISS index file and the metadata pickle exist — if either one alone is present (e.g. from a partial/interrupted write), it logs a warning and resets to an empty index rather than risking a corrupted partial load.

## Configuration

```env
VECTOR_STORE_PATH=/app/data/faiss_index      # dir; writes index.faiss + metadata.pkl inside it
EMBEDDING_MODEL=all-MiniLM-L6-v2             # sentence-transformers model name
LLM_ENDPOINT=http://neural-generator:8002/generate
```

`src/.env.example` exists in this directory but is currently empty — don't rely on it for defaults, use the values above.

## Running

```bash
cd services/api/rag
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # includes a CPU-only torch build in the Dockerfile;
                                    # if installing manually, install torch separately first:
                                    # pip install torch==2.3.1+cpu --index-url https://download.pytorch.org/whl/cpu

mkdir -p /app/data   # or wherever VECTOR_STORE_PATH points, if not /app/data

uvicorn src.app:app --host 0.0.0.0 --port 8001
```

**Interactive docs:** http://localhost:8001/docs

### Docker

```bash
cd services/api/rag
docker build -t reposense-rag:latest .
```

The Dockerfile installs the CPU-only PyTorch wheel explicitly before the rest of `requirements.txt` (to avoid pulling a CUDA build), sets `HF_HOME=/tmp/hf`, and creates `/app/data` for the vector store — but note `docker-compose.yml` overrides `HF_HOME` to `/root/.cache/huggingface` with a persistent `huggingface_cache` volume, and mounts `rag_data:/app/data`, so the container-baked `/tmp/hf`/`/app/data` paths from the Dockerfile aren't what's actually used when run via Compose.

Via Compose, this service `depends_on: neural-generator` with `condition: service_healthy` — it won't start accepting the "healthy" state until Neural Generator's own healthcheck passes (which has a 180s `start_period` for model load time), though the RAG process itself starts regardless; only its Compose-reported health gating is affected.

## Testing manually

```bash
curl -X POST http://localhost:8001/api/rag/index \
  -H "Content-Type: application/json" \
  -d '{
    "repo_name": "example",
    "files": [{"path": "main.py", "content": "def hello():\n    print(\"hi\")"}]
  }'

curl -X POST http://localhost:8001/api/rag/generate \
  -H "Content-Type: application/json" \
  -d '{"repo_name": "example", "prompt": "Generate a comprehensive README.md file for this repository"}'
```

## Troubleshooting

| Issue | Cause |
|---|---|
| `/generate` returns `{"readme": "# No indexed content found", "used_chunks": 0}` | Nothing has been indexed yet, or the FAISS index reset due to a partial-file load failure — call `/index` first |
| First request is slow | `Embedder()` downloads `all-MiniLM-L6-v2` from Hugging Face Hub on first instantiation; cached afterward |
| 500 error from `/generate` mentioning the Neural Generator | `LLM_ENDPOINT` unreachable, or the Neural Generator returned a non-JSON body — `Generator.generate()` calls `resp.json()["text"]` directly with no defensive check |
| Cross-repo content bleeding into results | Expected given the current implementation — see "Important gap" above |

## Related docs

- [services/api/neural_generator/README.md](../neural_generator/README.md)
- [services/api/README.md](../README.md)
- [services/README.md](../../README.md)