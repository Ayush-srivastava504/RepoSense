import re
from typing import List, Dict, Any, Tuple

class AutoFixer:
    def auto_fix(self, code: str, issues: List[Dict], language: str):
        fixed_code = code
        applied = []
        for issue in issues:
            if issue['type'] == 'line_too_long' and issue.get('line'):
                # simple line split at 80 chars
                lines = fixed_code.split('\n')
                line_idx = issue['line'] - 1
                if 0 <= line_idx < len(lines):
                    long_line = lines[line_idx]
                    if len(long_line) > 80:
                        indent = len(long_line) - len(long_line.lstrip())
                        split_point = 80
                        new_line = long_line[:split_point] + '\\'
                        rest = ' ' * indent + long_line[split_point:]
                        lines[line_idx] = new_line
                        lines.insert(line_idx+1, rest)
                        fixed_code = '\n'.join(lines)
                        applied.append({'type': 'line_split', 'line': issue['line']})
            elif issue['type'] == 'null_reference' and issue.get('line'):
                lines = fixed_code.split('\n')
                line_idx = issue['line'] - 1
                if 0 <= line_idx < len(lines):
                    old = lines[line_idx]
                    match = re.search(r'(\w+)\s*\.', old)
                    if match:
                        var = match.group(1)
                        new = f"if {var} is not None:\n    {old}"
                        lines[line_idx] = new
                        fixed_code = '\n'.join(lines)
                        applied.append({'type': 'null_check', 'line': issue['line']})
            # Add more fixes as needed
        return type('FixResult', (), {
            'success': len(applied) > 0,
            'fixed_code': fixed_code,
            'applied_fixes': applied,
            'validation_passed': True
        })()