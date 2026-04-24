from typing import List, Dict, Any, Optional
import numpy as np
from dataclasses import dataclass
import time
from collections import defaultdict

@dataclass
class DetectionMetrics:
    precision: float
    recall: float
    f1_score: float
    false_positives: int
    false_negatives: int
    true_positives: int
    true_negatives: int

@dataclass
class PerformanceMetrics:
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    throughput_rps: float
    memory_usage_mb: float

@dataclass
class QualityMetrics:
    issue_detection_rate: float
    false_positive_rate: float
    false_negative_rate: float
    avg_confidence: float
    fix_success_rate: float

class MetricsCalculator:
    def __init__(self):
        self.prediction_history = []
        self.latency_history = []
        self.fix_history = []
    
    def calculate_detection_metrics(
        self,
        predicted_issues: List[Dict[str, Any]],
        ground_truth: List[Dict[str, Any]]
    ) -> DetectionMetrics:
        predicted_set = {(i.get('line'), i.get('type')) for i in predicted_issues}
        truth_set = {(i.get('line'), i.get('type')) for i in ground_truth}
        
        true_positives = len(predicted_set & truth_set)
        false_positives = len(predicted_set - truth_set)
        false_negatives = len(truth_set - predicted_set)
        
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return DetectionMetrics(
            precision=precision,
            recall=recall,
            f1_score=f1,
            false_positives=false_positives,
            false_negatives=false_negatives,
            true_positives=true_positives,
            true_negatives=len(predicted_set) + len(truth_set) - true_positives - false_positives - false_negatives
        )
    
    def calculate_performance_metrics(
        self,
        latencies: List[float],
        total_requests: int,
        total_time_seconds: float
    ) -> PerformanceMetrics:
        sorted_latencies = sorted(latencies)
        
        return PerformanceMetrics(
            avg_latency_ms=np.mean(latencies),
            p50_latency_ms=np.percentile(sorted_latencies, 50),
            p95_latency_ms=np.percentile(sorted_latencies, 95),
            p99_latency_ms=np.percentile(sorted_latencies, 99),
            throughput_rps=total_requests / total_time_seconds,
            memory_usage_mb=self._get_memory_usage()
        )
    
    def calculate_quality_metrics(
        self,
        detections: List[DetectionMetrics],
        fixes: List[bool]
    ) -> QualityMetrics:
        avg_precision = np.mean([d.precision for d in detections])
        avg_recall = np.mean([d.recall for d in detections])
        
        false_positive_rates = [d.false_positives / (d.false_positives + d.true_negatives) if (d.false_positives + d.true_negatives) > 0 else 0 for d in detections]
        false_negative_rates = [d.false_negatives / (d.false_negatives + d.true_positives) if (d.false_negatives + d.true_positives) > 0 else 0 for d in detections]
        
        return QualityMetrics(
            issue_detection_rate=(avg_precision + avg_recall) / 2,
            false_positive_rate=np.mean(false_positive_rates),
            false_negative_rate=np.mean(false_negative_rates),
            avg_confidence=0.85,
            fix_success_rate=np.mean(fixes) if fixes else 0
        )
    
    def _get_memory_usage(self) -> float:
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024
    
    def track_prediction(self, predicted: List[Dict], actual: List[Dict]):
        metrics = self.calculate_detection_metrics(predicted, actual)
        self.prediction_history.append(metrics)
    
    def track_latency(self, latency_ms: float):
        self.latency_history.append(latency_ms)
    
    def track_fix_attempt(self, success: bool):
        self.fix_history.append(success)
    
    def get_summary(self) -> Dict[str, Any]:
        if not self.prediction_history:
            return {}
        
        recent_detections = self.prediction_history[-100:]
        recent_fixes = self.fix_history[-100:]
        
        quality_metrics = self.calculate_quality_metrics(recent_detections, recent_fixes)
        
        return {
            'detection_metrics': quality_metrics.__dict__,
            'avg_latency_ms': np.mean(self.latency_history[-1000:]) if self.latency_history else 0,
            'total_predictions': len(self.prediction_history),
            'total_fix_attempts': len(self.fix_history),
            'fix_success_rate': quality_metrics.fix_success_rate
        }

class AICodeMetrics:
    @staticmethod
    def calculate_complexity(code: str, language: str) -> Dict[str, float]:
        if language == 'python':
            return AICodeMetrics._calculate_python_complexity(code)
        elif language in ['javascript', 'typescript']:
            return AICodeMetrics._calculate_javascript_complexity(code)
        return {}
    
    @staticmethod
    def _calculate_python_complexity(code: str) -> Dict[str, float]:
        try:
            tree = ast.parse(code)
            
            complexity = 0
            functions = 0
            classes = 0
            imports = 0
            
            for node in ast.walk(tree):
                if isinstance(node, (ast.If, ast.While, ast.For, ast.And, ast.Or)):
                    complexity += 1
                elif isinstance(node, ast.FunctionDef):
                    functions += 1
                    complexity += len(node.body)
                elif isinstance(node, ast.ClassDef):
                    classes += 1
                elif isinstance(node, (ast.Import, ast.ImportFrom)):
                    imports += 1
            
            lines = len(code.split('\n'))
            
            return {
                'cyclomatic_complexity': complexity,
                'cognitive_complexity': complexity * 0.8,
                'functions_count': functions,
                'classes_count': classes,
                'imports_count': imports,
                'lines_of_code': lines,
                'maintainability_index': max(0, 100 - (complexity / lines * 100)) if lines > 0 else 100
            }
        except:
            return {}
    
    @staticmethod
    def _calculate_javascript_complexity(code: str) -> Dict[str, float]:
        complexity = code.count('if') + code.count('for') + code.count('while')
        functions = code.count('function')
        lines = len(code.split('\n'))
        
        return {
            'cyclomatic_complexity': complexity,
            'cognitive_complexity': complexity * 0.8,
            'functions_count': functions,
            'lines_of_code': lines,
            'maintainability_index': max(0, 100 - (complexity / lines * 100)) if lines > 0 else 100
        }