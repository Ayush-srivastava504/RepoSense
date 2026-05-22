#!/usr/bin/env python3

import os
from pathlib import Path

from transformers import AutoTokenizer, AutoModelForSequenceClassification
from optimum.onnxruntime import ORTQuantizer
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from optimum.onnxruntime.io_binding import ORTBertSentenceTransformer


def quantize_codebert():
    model_name = "microsoft/codebert-base"

    output_dir = Path("models/codebert_quantized")
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Quantizing {model_name}...")
    print(f"Output: {output_dir}")
    print()

    try:
        from optimum.onnxruntime import ORTModelForSequenceClassification

        model = ORTModelForSequenceClassification.from_pretrained(
            model_name,
            export=True,
            cache_dir=".model_cache",
        )

        model.save_pretrained(str(output_dir))

        quantizer = ORTQuantizer.from_pretrained(model)

        quantization_config = AutoQuantizationConfig.arm64(
            is_static=False,
            per_channel=False,
        )

        quantizer.quantize(
            save_dir=str(output_dir / "quantized"),
            quantization_config=quantization_config,
        )

    except Exception as e:
        print(f"Quantization failed: {e}")


if __name__ == "__main__":
    quantize_codebert()