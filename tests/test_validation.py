# test_validation.py
from ml.inference.validation_engine import ValidationEngine

validator = ValidationEngine()

test_cases = [
    ("def valid_function():\n    return True", "python", True),
    ("def invalid_function()\n    return", "python", False),
    ("function validJS() { return true; }", "javascript", True),
]

for code, lang, expected in test_cases:
    result = validator.validate(code, lang)
    status = "✓" if result.passed == expected else "✗"
    print(f"{status} {lang}: {'Valid' if result.passed else 'Invalid'} (Expected: {expected})")
    if result.errors:
        print(f"   Errors: {result.errors}")