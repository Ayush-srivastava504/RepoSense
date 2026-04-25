from typing import List, Dict, Any

class Postprocessor:
    def process(self, issues: List[Dict], code_length: int) -> Dict:
        severity_counts = {'critical':0, 'high':0, 'medium':0, 'low':0}
        for i in issues:
            sev = i.get('severity', 'medium')
            severity_counts[sev] = severity_counts.get(sev,0)+1
        total = len(issues)
        summary = f"Found {total} issues: {severity_counts['critical']} critical, {severity_counts['high']} high."
        return {
            'issues': issues,
            'quality_metrics': {
                'lines_of_code': code_length,
                'issue_density': total / max(code_length/100,1),
                'severity_breakdown': severity_counts
            },
            'summary': summary
        }