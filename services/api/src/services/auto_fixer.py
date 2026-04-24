import re
import ast
import os
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import json

class FixType(Enum):
    NULL_CHECK = "null_check"
    ERROR_HANDLING = "error_handling"
    RESOURCE_MANAGEMENT = "resource_management"
    LINE_SPLIT = "line_split"
    SIMPLIFY_EXPRESSION = "simplify_expression"
    REMOVE_HARDCODED = "remove_hardcoded"
    ADD_TYPE_HINT = "add_type_hint"
    RENAME_VARIABLE = "rename_variable"

@dataclass
class FixResult:
    success: bool
    fixed_code: Optional[str]
    applied_fixes: List[Dict[str, Any]]
    validation_passed: bool
    error_message: Optional[str] = None

class AutoFixer:
    def __init__(self):
        self.fix_handlers = {
            FixType.NULL_CHECK: self._fix_null_check,
            FixType.ERROR_HANDLING: self._fix_error_handling,
            FixType.RESOURCE_MANAGEMENT: self._fix_resource_management,
            FixType.LINE_SPLIT: self._fix_line_split,
            FixType.SIMPLIFY_EXPRESSION: self._fix_simplify_expression,
            FixType.REMOVE_HARDCODED: self._fix_remove_hardcoded,
            FixType.ADD_TYPE_HINT: self._fix_add_type_hint,
            FixType.RENAME_VARIABLE: self._fix_rename_variable,
        }
    
    def auto_fix(self, code: str, issues: List[Dict[str, Any]], language: str) -> FixResult:
        fixed_code = code
        applied_fixes = []
        
        for issue in sorted(issues, key=lambda x: x.get('confidence', 0), reverse=True):
            if issue.get('confidence', 0) < 0.8:
                continue
            
            fix_type = self._determine_fix_type(issue)
            if fix_type and fix_type in self.fix_handlers:
                try:
                    result = self.fix_handlers[fix_type](fixed_code, issue, language)
                    if result[0]:
                        fixed_code = result[0]
                        applied_fixes.append({
                            'type': fix_type.value,
                            'issue': issue['message'],
                            'lines_affected': result[1] if len(result) > 1 else None
                        })
                except Exception:
                    continue
        
        validation_passed = self._validate_fixed_code(fixed_code, language)
        
        return FixResult(
            success=len(applied_fixes) > 0,
            fixed_code=fixed_code if validation_passed else None,
            applied_fixes=applied_fixes,
            validation_passed=validation_passed,
            error_message=None if validation_passed else "Fixed code failed validation"
        )
    
    def _determine_fix_type(self, issue: Dict[str, Any]) -> Optional[FixType]:
        category = issue.get('category')
        
        if category == 'security':
            return FixType.REMOVE_HARDCODED
        
        mapping = {
            'null_reference': FixType.NULL_CHECK,
            'missing_error_handling': FixType.ERROR_HANDLING,
            'resource_leak': FixType.RESOURCE_MANAGEMENT,
            'line_too_long': FixType.LINE_SPLIT,
            'high_complexity': FixType.SIMPLIFY_EXPRESSION,
            'hardcoded_secret': FixType.REMOVE_HARDCODED,
            'missing_type': FixType.ADD_TYPE_HINT,
            'poor_naming': FixType.RENAME_VARIABLE,
        }
        
        issue_type = issue.get('type')
        return mapping.get(issue_type)
    
    def _fix_null_check(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            pattern = r'(\w+)\s*\.'
            lines = code.split('\n')
            line_idx = issue.get('line', 0) - 1
            
            if 0 <= line_idx < len(lines):
                match = re.search(pattern, lines[line_idx])
                if match:
                    var_name = match.group(1)
                    fixed_line = f"if {var_name} is not None:\n    {lines[line_idx]}"
                    lines[line_idx] = fixed_line
                    return '\n'.join(lines), line_idx + 1
        
        return None, 0
    
    def _fix_error_handling(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            lines = code.split('\n')
            line_idx = issue.get('line', 0) - 1
            
            if 0 <= line_idx < len(lines):
                indent = len(lines[line_idx]) - len(lines[line_idx].lstrip())
                try_block = lines[line_idx]
                fixed_block = f"{' ' * indent}try:\n{' ' * (indent + 4)}{try_block.lstrip()}\n{' ' * indent}except Exception as e:\n{' ' * (indent + 4)}logger.error(f'Error: {{e}}')\n{' ' * (indent + 4)}raise"
                lines[line_idx] = fixed_block
                return '\n'.join(lines), line_idx + 1
        
        return None, 0
    
    def _fix_resource_management(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            pattern = r'(\w+)\s*=\s*open\(([^)]+)\)'
            lines = code.split('\n')
            line_idx = issue.get('line', 0) - 1
            
            if 0 <= line_idx < len(lines):
                match = re.search(pattern, lines[line_idx])
                if match:
                    var_name = match.group(1)
                    args = match.group(2)
                    fixed_line = f"with open({args}) as {var_name}:"
                    lines[line_idx] = fixed_line
                    return '\n'.join(lines), line_idx + 1
        
        return None, 0
    
    def _fix_line_split(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        lines = code.split('\n')
        line_idx = issue.get('line', 0) - 1
        
        if 0 <= line_idx < len(lines):
            long_line = lines[line_idx]
            indent = len(long_line) - len(long_line.lstrip())
            
            if language == 'python':
                if '(' in long_line and ')' in long_line:
                    split_point = long_line.find('(') + 1
                    first_part = long_line[:split_point]
                    remaining = long_line[split_point:-1]
                    
                    args = remaining.split(',')
                    if len(args) > 1:
                        new_lines = [first_part]
                        for i, arg in enumerate(args):
                            comma = ',' if i < len(args) - 1 else ''
                            new_lines.append(f"{' ' * (indent + 4)}{arg.strip()}{comma}")
                        new_lines.append(f"{' ' * indent})")
                        
                        lines[line_idx:line_idx+1] = new_lines
                        return '\n'.join(lines), line_idx + 1
        
        return None, 0
    
    def _fix_simplify_expression(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            lines = code.split('\n')
            line_idx = issue.get('line', 0) - 1
            
            if 0 <= line_idx < len(lines):
                line = lines[line_idx]
                
                line = re.sub(r'if\s+(\w+)\s*==\s*True', r'if \1', line)
                line = re.sub(r'if\s+(\w+)\s*==\s*False', r'if not \1', line)
                line = re.sub(r'not\s+not\s+(\w+)', r'\1', line)
                line = re.sub(r'(\w+)\s*and\s*True', r'\1', line)
                line = re.sub(r'(\w+)\s*or\s*False', r'\1', line)
                
                lines[line_idx] = line
                return '\n'.join(lines), line_idx + 1
        
        return None, 0
    
    def _fix_remove_hardcoded(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            pattern = r'(password|api[_-]?key|secret|token)\s*=\s*["\'][^"\']+["\']'
            lines = code.split('\n')
            
            for i, line in enumerate(lines):
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    var_name = match.group(1)
                    lines[i] = f"{var_name} = os.environ.get('{var_name.upper()}', '')"
                    return '\n'.join(lines), i + 1
        
        return None, 0
    
    def _fix_add_type_hint(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            pattern = r'def\s+(\w+)\s*\(([^)]*)\)\s*:'
            lines = code.split('\n')
            
            for i, line in enumerate(lines):
                match = re.search(pattern, line)
                if match:
                    params = match.group(2)
                    
                    if ':' not in params and params.strip():
                        param_list = [p.strip() for p in params.split(',') if p.strip()]
                        typed_params = []
                        for param in param_list:
                            if '=' not in param:
                                typed_params.append(f"{param}: Any")
                            else:
                                typed_params.append(param)
                        
                        new_params = ', '.join(typed_params)
                        lines[i] = line.replace(params, new_params)
                        return '\n'.join(lines), i + 1
        
        return None, 0
    
    def _fix_rename_variable(self, code: str, issue: Dict[str, Any], language: str) -> Tuple[Optional[str], int]:
        if language == 'python':
            poor_names = ['x', 'y', 'z', 'a', 'b', 'c', 'temp', 'tmp', 'foo', 'bar']
            
            lines = code.split('\n')
            line_idx = issue.get('line', 0) - 1
            
            if 0 <= line_idx < len(lines):
                line = lines[line_idx]
                for poor_name in poor_names:
                    pattern = rf'\b{poor_name}\b'
                    if re.search(pattern, line):
                        meaningful_name = self._suggest_meaningful_name(line, poor_name)
                        line = re.sub(pattern, meaningful_name, line)
                        lines[line_idx] = line
                        return '\n'.join(lines), line_idx + 1
        
        return None, 0
    
    def _suggest_meaningful_name(self, line: str, old_name: str) -> str:
        if '=' in line:
            context = line.split('=')[0].strip()
            if 'count' in context or 'len' in context:
                return 'count'
            if 'list' in context or 'arr' in context:
                return 'items'
            if 'result' in context:
                return 'result'
        return old_name
    
    def _validate_fixed_code(self, code: str, language: str) -> bool:
        try:
            if language == 'python':
                ast.parse(code)
                return True
            elif language in ['javascript', 'typescript']:
                import js2py
                js2py.eval_js(code)
                return True
            return True
        except Exception:
            return False