import faiss
import numpy as np
import pickle
import os
from typing import List, Tuple
from ..config import VECTOR_STORE_PATH

class VectorStore:
    def __init__(self, dimension: int = 384):
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)
        self.metadata = []
        self.load()

    def add(self, vectors: np.ndarray, metadata: List[dict]):
        self.index.add(vectors)
        self.metadata.extend(metadata)

    def search(self, query_vector: np.ndarray, k: int = 5) -> List[Tuple[float, dict]]:
        distances, indices = self.index.search(query_vector, k)
        results = []
        for idx, dist in zip(indices[0], distances[0]):
            if idx >= 0:
                results.append((float(dist), self.metadata[idx]))
        return results

    def save(self):
        os.makedirs(VECTOR_STORE_PATH, exist_ok=True)
        faiss.write_index(self.index, f"{VECTOR_STORE_PATH}/index.faiss")
        with open(f"{VECTOR_STORE_PATH}/metadata.pkl", "wb") as f:
            pickle.dump(self.metadata, f)

    def load(self):
        """Load both index and metadata together to prevent partial load crashes."""
        idx_path = f"{VECTOR_STORE_PATH}/index.faiss"
        meta_path = f"{VECTOR_STORE_PATH}/metadata.pkl"
        # Only load if both files exist to avoid partial load corruption
        if os.path.exists(idx_path) and os.path.exists(meta_path):
            try:
                self.index = faiss.read_index(idx_path)
                with open(meta_path, "rb") as f:
                    self.metadata = pickle.load(f)
            except Exception as e:
                print(f"[WARN] Failed to load vector store: {e}; starting fresh")
                # Reset to empty state on load failure
                self.index = faiss.IndexFlatIP(self.dimension)
                self.metadata = []