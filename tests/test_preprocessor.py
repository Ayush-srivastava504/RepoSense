# test_preprocessor.py
from ml.preprocessing.code_preprocessor import CodePreprocessor

preprocessor = CodePreprocessor()

test_cases = [
    ("# This is a comment\ndef test():\n    pass", "python"),
    ("// JavaScript comment\nfunction test() {\n  return true;\n}", "javascript"),
]

for code, lang in test_cases:
    result = preprocessor.preprocess(code, lang)
    print(f"Language: {lang}")
    print(f"Original lines: {len(code.split(chr(10)))}")
    print(f"Preprocessed chunks: {len(result)}")
    print(f"First chunk length: {len(result[0])}")
    print("-" * 40)