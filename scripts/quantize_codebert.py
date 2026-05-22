#!/usr/bin/env python3
"""
Quantize CodeBERT model to ONNX format for low-memory environments.
This creates a quantized model (~60-100MB instead of 500MB).
"""

import os
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from optimum.onnxruntime import ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from optimum.onnxruntime.io_binding import ORTBertSentenceTransformer

def quantize_codebert():
    """Quantize CodeBERT to ONNX format."""
    
    model_name = "microsoft/codebert-base"
    output_dir = Path("models/codebert_quantized")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Quantizing {model_name}...")
    print(f"Output: {output_dir}")
    print()
    
    # Download and quantize model
    try:
        # Step 1: Convert to ONNX
        from optimum.onnxruntime import ORTModelForSequenceClassification
        
        model = ORTModelForSequenceClassification.from_pretrained(
            model_name,
            export=True,
            cache_dir=".model_cache",
        )
        
        # Save the model
        model.save_pretrained(str(output_dir))
        
        # Step 2: Quantize the model
        quantizer = ORTQuantizer.from_pretrained(model)
        quantization_config = AutoQuantizationConfig.arm64(is_static=False, per_channel=False)
        
        quantizer.quantize(
            save_dir=str(output_dir / "quantized"),
            quantization_config=quantization_config,
        )
        
        print(f"✓ Model quantized successfully!")
        print(f"✓ Saved to: {output_dir}")
        print()
        print("Update CODEBERT_ONNX_PATH in .env to:")
        print(f"  CODEBERT_ONNX_PATH={str(output_dir / 'quantized' / 'model.onnx')}")
        
    except Exception as e:
        print(f"Error during quantization: {e}")
        print()
        print("Alternative: Download pre-quantized CodeBERT from Hugging Face")
        print("  https://huggingface.co/microsoft/codebert-base")
        print()
        print("Or use a smaller model like:")
        print("  - huggingface/distilbert-base-uncased (~66MB)")
        print("  - microsoft/codebert-base-mlm (~330MB but still small)")

if __name__ == "__main__":
    quantize_codebert()
