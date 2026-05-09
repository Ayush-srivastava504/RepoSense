# test_autofix.py
from services.api.src.services.auto_fixer import AutoFixer

fixer = AutoFixer()

problematic_code = """
def calculate():
    result = None
    if condition:
        result = 10 / 0
    return result.value

api_key = 'secret123'
"""

issues = [
    {
        'type': 'null_reference',
        'message': 'Potential null reference',
        'line': 4,
        'confidence': 0.9
    },
    {
        'type': 'hardcoded_secret',
        'message': 'Hardcoded API key',
        'line': 7,
        'confidence': 0.95
    }
]

result = fixer.auto_fix(problematic_code, issues, "python")
print(f"Fix success: {result.success}")
print(f"Applied fixes: {len(result.applied_fixes)}")
if result.success:
    print("\nFixed code:")
    print(result.fixed_code)