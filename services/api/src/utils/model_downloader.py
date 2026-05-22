# Model downloader and cache manager for Hugging Face models.

import os
import logging
import warnings
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class ModelDownloader:

    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir or os.getenv("MODEL_CACHE_DIR", ".model_cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Model cache directory: {self.cache_dir}")

    def download_codebert(self, model_name: str = "microsoft/codebert-base") -> Dict[str, Any]:
        try:
            from transformers import AutoModel, AutoTokenizer

            logger.info(f"Downloading CodeBERT model: {model_name}")

            model = AutoModel.from_pretrained(
                model_name,
                cache_dir=str(self.cache_dir),
                trust_remote_code=True,  # only use with trusted repos
            )
            tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=str(self.cache_dir),
                trust_remote_code=True,  # only use with trusted repos
            )

            logger.info(f"Successfully loaded CodeBERT: {model_name}")
            return {
                "type": "codebert",
                "name": model_name,
                "model": model,
                "tokenizer": tokenizer,
                "cache_dir": str(self.cache_dir),
                "success": True,
            }

        except Exception as e:
            logger.error(f"Failed to download CodeBERT: {e}")
            return {"type": "codebert", "success": False, "error": str(e)}

    def download_qwen_gguf(
        self,
        repo_id: str = "TheBloke/Qwen2-0.5B-Instruct-GGUF",
        filename: str = "qwen2-0.5b-instruct.Q4_K_M.gguf",
    ) -> Dict[str, Any]:
        try:
            from huggingface_hub import hf_hub_download

            logger.info(f"Downloading Qwen model: {repo_id}/{filename}")

            model_path = hf_hub_download(
                repo_id=repo_id,
                filename=filename,
                cache_dir=str(self.cache_dir),
            )

            logger.info(f"Successfully downloaded Qwen model to: {model_path}")
            return {
                "type": "qwen_gguf",
                "repo_id": repo_id,
                "filename": filename,
                "local_path": str(model_path),
                "success": True,
            }

        except Exception as e:
            logger.error(f"Failed to download Qwen GGUF: {e}")
            return {"type": "qwen_gguf", "success": False, "error": str(e)}

    def download_custom_model(
        self,
        repo_id: str,
        filename: Optional[str] = None,
        model_type: str = "transformer",
    ) -> Dict[str, Any]:
        try:
            if model_type == "gguf":
                if not filename:
                    raise ValueError("filename is required for model_type='gguf'")

                from huggingface_hub import hf_hub_download

                model_path = hf_hub_download(
                    repo_id=repo_id,
                    filename=filename,
                    cache_dir=str(self.cache_dir),
                )
                logger.info(f"Downloaded {model_type} model to: {model_path}")
                return {
                    "type": model_type,
                    "repo_id": repo_id,
                    "filename": filename,
                    "local_path": str(model_path),
                    "success": True,
                }

            elif model_type == "transformer":
                from transformers import AutoModel, AutoTokenizer

                model = AutoModel.from_pretrained(
                    repo_id,
                    cache_dir=str(self.cache_dir),
                    trust_remote_code=True,  # only use with trusted repos
                )
                tokenizer = AutoTokenizer.from_pretrained(
                    repo_id,
                    cache_dir=str(self.cache_dir),
                    trust_remote_code=True,  # only use with trusted repos
                )

                logger.info(f"Downloaded transformer model: {repo_id}")
                return {
                    "type": "transformer",
                    "repo_id": repo_id,
                    "model": model,
                    "tokenizer": tokenizer,
                    "cache_dir": str(self.cache_dir),
                    "success": True,
                }

            else:
                raise ValueError(f"Unsupported model_type: '{model_type}'. Expected 'transformer' or 'gguf'.")

        except Exception as e:
            logger.error(f"Failed to download custom model {repo_id}: {e}")
            return {"type": model_type, "success": False, "error": str(e)}

    def get_cached_models(self) -> Dict[str, list]:
        cached: Dict[str, list] = {"transformers": [], "gguf": []}

        # deduplicate transformer names across multiple snapshots/revisions
        cached["transformers"] = sorted({
            folder.parent.parent.name
            for folder in self.cache_dir.glob("models--*/snapshots/*/")
            if folder.exists()
        })

        cached["gguf"] = [str(f) for f in self.cache_dir.glob("*/*.gguf")]

        return cached

    def clear_cache(self, model_type: Optional[str] = None) -> bool:
        try:
            import shutil

            if model_type is None:
                shutil.rmtree(self.cache_dir)
                self.cache_dir.mkdir(parents=True, exist_ok=True)
                logger.info("Cleared entire model cache")

            elif model_type == "transformer":
                for folder in self.cache_dir.glob("models--*/"):
                    shutil.rmtree(folder)
                logger.info("Cleared transformer model cache")

            elif model_type == "gguf":
                for gguf_file in self.cache_dir.glob("*/*.gguf"):
                    gguf_file.unlink()
                logger.info("Cleared GGUF model cache")

            else:
                raise ValueError(f"Unsupported model_type: '{model_type}'. Expected None, 'transformer', or 'gguf'.")

            return True

        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False


_downloader: Optional[ModelDownloader] = None


def get_downloader(cache_dir: Optional[str] = None) -> ModelDownloader:
    global _downloader
    if _downloader is None:
        _downloader = ModelDownloader(cache_dir)
    else:
        # warn if caller passes cache_dir after singleton is already initialized
        if cache_dir is not None:
            warnings.warn(
                "Singleton already exists — cache_dir argument ignored. "
                "Instantiate ModelDownloader directly to use a different path.",
                UserWarning,
                stacklevel=2,
            )
    return _downloader