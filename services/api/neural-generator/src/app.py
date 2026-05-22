from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import resource
from llama_cpp import Llama

# Set low memory limit (optional, to prevent OOM)
# resource.setrlimit(resource.RLIMIT_AS, (2 * 1024 * 1024 * 1024, 2 * 1024 * 1024 * 1024))

app = FastAPI(title="Local LLM Generator", version="1.0.0")

# Use llama-cpp-python library instead of external binary.
# The model path is read from the environment (MODEL_PATH) with a sensible default.
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/qwen3-codersmall-0.8b-q4_k_m.gguf")
# Initialize Llama instance lazily inside the endpoint to avoid heavy startup cost.

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 512
    temperature: float = 0.2
    top_k: int = 40
    top_p: float = 0.9

@app.post("/generate")
async def generate(request: GenerateRequest):
    """Generate text using the Llama model.

    The llama-cpp-python library runs the model in-process, eliminating the need
    for an external binary and allowing us to respect the ``MODEL_PATH``
    environment variable.
    """
    # Initialize Llama with a small thread count to keep resource usage low.
    try:
        llm = Llama(
            model_path=MODEL_PATH,
            n_threads=2,
            n_gpu_layers=0,
            verbose=False,
        )
    except Exception as exc:
        raise HTTPException(500, f"Failed to load model: {exc}")

    try:
        output = llm(
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_k=request.top_k,
            top_p=request.top_p,
            stop=None,
        )
    except Exception as exc:
        raise HTTPException(500, f"Generation error: {exc}")

    # ``output`` is a dict with a ``generation`` key containing the text.
    text = output.get("generation", "").strip()
    return {"text": text}

@app.get("/health")
async def health():
    return {"status": "ok"}