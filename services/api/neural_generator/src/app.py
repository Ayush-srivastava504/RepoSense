from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from llama_cpp import Llama

import logging

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Local LLM Generator",
    version="1.0.0",
)


class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 2500
    temperature: float = 0.55
    top_k: int = 50
    top_p: float = 0.92


MODEL_PATH = r"E:\Repo_Sense\services\api\neural_generator\models\Qwen3-0.6B-Q4_K_M.gguf"

logger.info(
    f"Loading model from: {MODEL_PATH}"
)

llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=4096,
    n_threads=2,
    n_gpu_layers=0,
    verbose=False,
)

logger.info(
    "Qwen model loaded successfully"
)


@app.post("/generate")
async def generate(request: GenerateRequest):

    try:

        logger.info("Generating text...")

        output = llm(
            request.prompt,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_k=request.top_k,
            top_p=request.top_p,
            repeat_penalty=1.2,
            stop=["</s>"],
        )

        text = (
            output.get(
                "choices",
                [{}]
            )[0]
            .get("text", "")
            .strip()
        )

        return {
            "text": text
        }

    except Exception as exc:

        logger.error(
            f"Generation error: {exc}"
        )

        raise HTTPException(
            500,
            f"Generation error: {exc}"
        )


@app.get("/health")
async def health():

    return {
        "status": "ok"
    }