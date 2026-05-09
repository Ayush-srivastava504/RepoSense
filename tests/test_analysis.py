# test_analysis.py
from ml.model.model_loader import ModelLoader
from services.api.src.services.analysis_engine import CodeAnalysisEngine

loader = ModelLoader()
model, tokenizer = loader.get_model()
engine = CodeAnalysisEngine(model, tokenizer, loader.device)

test_code = """
def buggy_function():
    x = None
    return x.value
    
password = 'hardcoded123'
    
def long_function_with_many_parameters(param1, param2, param3, param4, param5, param6):
    pass
"""

issues = engine.analyze(test_code, "python")
print(f"Found {len(issues)} issues:")
for issue in issues:
    print(f"  - [{issue['severity']}] {issue['type']}: {issue['message']}")