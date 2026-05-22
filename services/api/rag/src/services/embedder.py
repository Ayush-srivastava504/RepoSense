import numpy as np
from sentence_transformers import SentenceTransformer
from ..config import EMBEDDING_MODEL

class Embedder:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.model = SentenceTransformer(EMBEDDING_MODEL)
        return cls._instance

    def embed(self, texts: list) -> np.ndarray:
        return self.model.encode(texts, normalize_embeddings=True)