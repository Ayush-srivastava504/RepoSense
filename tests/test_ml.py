import pytest
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ml.preprocessing.code_preprocessor import CodePreprocessor
from ml.inference.analysis_engine import CodeAnalysisEngine
from ml.inference.auto_fixer import AutoFixer
from ml.inference.validation_engine import ValidationEngine
from ml.evaluation.metrics import MetricsCalculator, AICodeMetrics

class TestCodePreprocessor:
    def setup_method(self):
        self.preprocessor = CodePreprocessor()
    
    def test_preprocess_python(self):
        code = "# comment\ndef test():\n    pass"
        result = self.preprocessor.preprocess(code, "python")
        assert len(result) == 1
        assert "comment" not in result[0]
    
    def test_chunking(self):
        long_code = "\n".join([f"line {i}" for i in range(1000)])
        chunks = self.preprocessor.preprocess(long_code, "python")
        assert len(chunks) > 1
    
    def test_extract_features(self):
        code = "line1\nline2\n\nline3"
        features = self.preprocessor.extract_features(code)
        assert features['line_count'] == 4
        assert features['blank_lines'] == 1

class TestAnalysisEngine:
    def setup_method(self):
        from ml.model.model_loader import ModelLoader
        loader = ModelLoader()
        model, tokenizer = loader.get_model()
        device = loader.device
        self.engine = CodeAnalysisEngine(model, tokenizer, device)
    
    def test_bug_detection(self):
        code = "x = None\nx.value"
        issues = self.engine._detect_bugs(code, "python")
        assert len(issues) > 0
        assert issues[0]['type'] == 'null_reference'
    
    def test_quality_analysis(self):
        code = "x" * 200
        issues = self.engine._analyze_quality(code, "python")
        assert any(i['type'] == 'line_too_long' for i in issues)
    
    def test_readability_checks(self):
        code = "password = 'hardcoded123'"
        issues = self.engine._check_readability(code, "python")
        assert any(i['type'] == 'hardcoded_secret' for i in issues)

class TestAutoFixer:
    def setup_method(self):
        self.fixer = AutoFixer()
    
    def test_fix_null_check(self):
        code = "result = obj.value"
        issue = {
            'type': 'null_reference',
            'message': 'Potential null reference',
            'line': 1,
            'confidence': 0.9
        }
        result, line = self.fixer._fix_null_check(code, issue, "python")
        assert result is not None
        assert "if obj is not None" in result
    
    def test_fix_line_split(self):
        long_line = "result = function_with_many_parameters(param1, param2, param3, param4, param5)"
        issue = {
            'type': 'line_too_long',
            'line': 1,
            'confidence': 0.85
        }
        result, _ = self.fixer._fix_line_split(long_line, issue, "python")
        assert result is not None
        assert "\n" in result
    
    def test_fix_hardcoded_secrets(self):
        code = "api_key = 'secret123'"
        issue = {
            'type': 'hardcoded_secret',
            'line': 1,
            'confidence': 0.95
        }
        result, _ = self.fixer._fix_remove_hardcoded(code, issue, "python")
        assert result is not None
        assert "os.environ.get" in result

class TestValidationEngine:
    def setup_method(self):
        self.validator = ValidationEngine()
    
    def test_validate_valid_python(self):
        code = "def test():\n    return True"
        result = self.validator.validate(code, "python")
        assert result.passed == True
        assert len(result.errors) == 0
    
    def test_validate_invalid_python(self):
        code = "def test()\n    return"
        result = self.validator.validate(code, "python")
        assert result.passed == False
        assert len(result.errors) > 0
    
    def test_python_style_validation(self):
        code = "def Test():\n\tpass"
        result = self.validator.validate(code, "python")
        assert len(result.warnings) > 0

class TestMetricsCalculator:
    def setup_method(self):
        self.calculator = MetricsCalculator()
    
    def test_detection_metrics(self):
        predicted = [
            {'line': 1, 'type': 'bug'},
            {'line': 2, 'type': 'quality'}
        ]
        actual = [
            {'line': 1, 'type': 'bug'},
            {'line': 3, 'type': 'readability'}
        ]
        
        metrics = self.calculator.calculate_detection_metrics(predicted, actual)
        assert metrics.true_positives == 1
        assert metrics.false_positives == 1
        assert metrics.false_negatives == 1
    
    def test_performance_metrics(self):
        latencies = [100, 150, 200, 250, 300]
        metrics = self.calculator.calculate_performance_metrics(latencies, 100, 10)
        assert metrics.avg_latency_ms == 200
        assert metrics.p50_latency_ms == 200
        assert metrics.p95_latency_ms == 300
    
    def test_quality_metrics(self):
        detections = [
            self.calculator.calculate_detection_metrics(
                [{'line': 1, 'type': 'bug'}],
                [{'line': 1, 'type': 'bug'}]
            )
        ]
        fixes = [True, False, True]
        
        metrics = self.calculator.calculate_quality_metrics(detections, fixes)
        assert metrics.fix_success_rate == 2/3

class TestAICodeMetrics:
    def test_python_complexity(self):
        code = """
def complex_function(x):
    if x > 0:
        for i in range(x):
            if i % 2 == 0:
                print(i)
    return x
        """
        
        metrics = AICodeMetrics.calculate_complexity(code, "python")
        assert metrics['cyclomatic_complexity'] > 0
        assert metrics['functions_count'] == 1
        assert metrics['lines_of_code'] > 0
    
    def test_javascript_complexity(self):
        code = """
function test() {
    if (true) {
        for (let i = 0; i < 10; i++) {
            console.log(i);
        }
    }
}
        """
        
        metrics = AICodeMetrics.calculate_complexity(code, "javascript")
        assert metrics['cyclomatic_complexity'] >= 2
        assert metrics['functions_count'] == 1

class TestIntegration:
    def setup_method(self):
        self.preprocessor = CodePreprocessor()
        self.fixer = AutoFixer()
        self.validator = ValidationEngine()
    
    def test_end_to_end_fix_flow(self):
        problematic_code = """
def calculate(x, y):
    result = None
    if x:
        result = x / y
    return result.value
        """
        
        preprocessed = self.preprocessor.preprocess(problematic_code, "python")
        
        from ml.model.model_loader import ModelLoader
        loader = ModelLoader()
        model, tokenizer = loader.get_model()
        device = loader.device
        engine = CodeAnalysisEngine(model, tokenizer, device)
        
        issues = engine.analyze(problematic_code, "python")
        
        fix_result = self.fixer.auto_fix(problematic_code, issues, "python")
        
        if fix_result.success and fix_result.fixed_code:
            validation = self.validator.validate(fix_result.fixed_code, "python")
            assert validation.passed == True