from fastapi import APIRouter, HTTPException
from .models.schemas import IndexRequest, GenerateRequest, GenerateResponse
from .services.chunker import CodeChunker
from .services.embedder import Embedder
from .services.vector_store import VectorStore
from .services.generator import Generator

router = APIRouter(prefix="/api/rag", tags=["rag"])

embedder = Embedder()
store = VectorStore()

@router.post("/index")
async def index_repository(request: IndexRequest):
    try:
        all_chunks = []
        for file_item in request.files:
            chunks = CodeChunker.chunk_file(file_item.content, file_item.path)
            all_chunks.extend(chunks)

        if not all_chunks:
            return {"status": "no chunks", "chunks": 0}

        texts = [chunk["text"] for chunk in all_chunks]
        vectors = embedder.embed(texts)

        store.add(vectors, all_chunks)
        store.save()
        return {"status": "indexed", "chunks": len(all_chunks)}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/generate", response_model=GenerateResponse)
async def generate_readme(request: GenerateRequest):
    try:
        query_vec = embedder.embed([request.prompt])[0].reshape(1, -1)
        results = store.search(query_vec, k=10)

        if not results:
            return GenerateResponse(readme="# No indexed content found", used_chunks=0)

        context_parts = []
        for score, chunk in results:
            context_parts.append(f"File: {chunk['path']}\n```\n{chunk['text']}\n```")
        context = "\n\n".join(context_parts)

        readme = await Generator.generate(request.prompt, context)
        return GenerateResponse(readme=readme, used_chunks=len(results))
    except Exception as e:
        raise HTTPException(500, str(e))