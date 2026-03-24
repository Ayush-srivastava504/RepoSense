import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from typing import Tuple
import gc
from app.utils.logger import setup_logger
from configs.config import settings

logger = setup_logger(__name__)

class ModelLoader:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self.is_loaded = False
        self._load_model()
    
    def _load_model(self):
        try:
            if settings.model.DEVICE == "auto":
                self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            else:
                self.device = torch.device(settings.model.DEVICE)
            
            logger.info(f"Loading model on {self.device}")
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                settings.model.MODEL_NAME,
                cache_dir=settings.model.MODEL_CACHE_DIR
            )
            
            self.model = AutoModelForSequenceClassification.from_pretrained(
                settings.model.MODEL_NAME,
                cache_dir=settings.model.MODEL_CACHE_DIR,
                num_labels=10
            )
            
            if settings.model.QUANTIZATION_ENABLED and self.device.type == "cpu":
                self.model = torch.quantization.quantize_dynamic(
                    self.model, {torch.nn.Linear}, dtype=torch.qint8
                )
            
            self.model.to(self.device)
            self.model.eval()
            
            self.is_loaded = True
            logger.info("Model loaded successfully")
            
        except Exception as e:
            self.is_loaded = False
            logger.error(f"Failed to load model: {e}")
            raise
    
    def get_model(self) -> Tuple[AutoModelForSequenceClassification, AutoTokenizer]:
        if self.model is None or self.tokenizer is None:
            self._load_model()
        return self.model, self.tokenizer
    
    def unload_model(self):
        if self.model:
            del self.model
            del self.tokenizer
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            self.model = None
            self.tokenizer = None
            self.is_loaded = False
            logger.info("Model unloaded")
            