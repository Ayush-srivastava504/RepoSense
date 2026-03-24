# test_model_loading.py
import sys
sys.path.insert(0, '.')
from ml.inference.model_loader import ModelLoader

def test_model_loading():
    try:
        loader = ModelLoader()
        model, tokenizer = loader.get_model()
        print(f"✓ Model loaded: {model.config.model_type}")
        print(f"✓ Device: {loader.device}")
        print(f"✓ Tokenizer vocab size: {tokenizer.vocab_size}")
    except Exception as e:
        print(f"✗ Model loading failed: {e}")

if __name__ == "__main__":
    test_model_loading()