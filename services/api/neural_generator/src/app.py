# Module: neural_generator/src/app.py
# Defines class(es): GenerateRequest
# Defines function(s): load_model, generate, health
#

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title='Neural Generator', version='1.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 2500
    temperature: float = 0.55
    top_k: int = 50
    top_p: float = 0.92
MODEL_PATH = os.getenv('MODEL_PATH', '/app/models/Qwen3-0.6B-Q4_K_M.gguf')
N_THREADS = int(os.getenv('LLM_N_THREADS', '2'))
N_GPU_LAYERS = int(os.getenv('LLM_N_GPU_LAYERS', '0'))
N_CTX = int(os.getenv('LLM_N_CTX', '4096'))
llm = None

def load_model():
    global llm
    if not os.path.exists(MODEL_PATH):
        logger.error(f'Model not found at: {MODEL_PATH}')
        logger.error('Set MODEL_PATH env var or mount model volume correctly.')
        return
    try:
        from llama_cpp import Llama
        logger.info(f'Loading model from: {MODEL_PATH}')
        llm = Llama(model_path=MODEL_PATH, n_ctx=N_CTX, n_threads=N_THREADS, n_gpu_layers=N_GPU_LAYERS, verbose=False)
        logger.info('Model loaded successfully')
    except Exception as e:
        logger.error(f'Failed to load model: {e}')
load_model()

@app.post('/generate')
async def generate(request: GenerateRequest):
    if llm is None:
        raise HTTPException(503, 'Model not loaded. Check MODEL_PATH.')
    try:
        logger.info('Generating text...')
        output = llm(request.prompt, max_tokens=request.max_tokens, temperature=request.temperature, top_k=request.top_k, top_p=request.top_p, repeat_penalty=1.2, stop=['</s>'])
        text = output.get('choices', [{}])[0].get('text', '').strip()
        return {'text': text}
    except Exception as exc:
        logger.error(f'Generation error: {exc}')
        raise HTTPException(500, f'Generation error: {exc}')

@app.get('/health')
async def health():
    return {'status': 'ok', 'model_loaded': llm is not None}
