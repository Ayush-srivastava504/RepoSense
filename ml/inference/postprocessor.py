from typing import List, Dict, Any
import hashlib
import json

class Postprocessor:
    def __init__(self):
        pass
    
    def process(self, issues: List[Dict[str, Any]], code_length: int) -> Dict[str, Any]:
        processed_issues = []
        
        for issue in issues:
            processed_issue = {
                'severity': issue.get('severity', 'medium'),
                'category': issue.get('category', 'general'),
                'message': issue['message'],
                'suggestion': issue['suggestion'],
                'confidence': issue.get('confidence', 0.5)
            }
            
            if 'line' in issue:
                processed_issue['line'] = issue['line']
            if 'column' in issue:
                processed_issue['column'] = issue['column']
            
            processed_issues.append(processed_issue)
        
        quality_metrics = self._calculate_metrics(processed_issues, code_length)
        
        summary = self._generate_summary(processed_issues, quality_metrics)
        
        return {
            'issues': processed_issues,
            'quality_metrics': quality_metrics,
            'summary': summary
        }
    
    def _calculate_metrics(self, issues: List[Dict[str, Any]], code_length: int) -> Dict[str, Any]:
        severity_counts = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'low': 0,
            'info': 0
        }
        
        for issue in issues:
            severity = issue.get('severity', 'medium')
            if severity in severity_counts:
                severity_counts[severity] += 1
        
        total_issues = len(issues)
        issue_density = total_issues / max(code_length / 100, 1)
        
        complexity_score = max(0, 100 - (total_issues * 10))
        maintainability_index = max(0, 100 - (severity_counts['critical'] * 20 + severity_counts['high'] * 10))
        
        return {
            'complexity_score': round(complexity_score, 2),
            'maintainability_index': round(maintainability_index, 2),
            'duplication_rate': round(min(issue_density * 5, 100), 2),
            'comment_ratio': 0.0,
            'lines_of_code': code_length,
            'issue_density': round(issue_density, 2),
            'severity_breakdown': severity_counts
        }
    
    def _generate_summary(self, issues: List[Dict[str, Any]], metrics: Dict[str, Any]) -> str:
        if not issues:
            return "No issues found. Code quality looks good!"
        
        critical_count = metrics['severity_breakdown']['critical']
        high_count = metrics['severity_breakdown']['high']
        
        if critical_count > 0:
            return f"Found {critical_count} critical and {high_count} high severity issues that require immediate attention."
        elif high_count > 0:
            return f"Found {high_count} high severity issues that should be addressed."
        else:
            return f"Found {len(issues)} issues that could improve code quality."
    
    def generate_response_id(self, code: str) -> str:
        return hashlib.md5(code.encode()).hexdigest()[:8]