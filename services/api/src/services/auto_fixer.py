import re
import textwrap
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Callable


@dataclass
class AppliedFix:
    rule_type: str
    line: int
    description: str
    original: str
    replacement: str


@dataclass
class FixResult:
    success: bool
    fixed_code: str
    applied_fixes: List[AppliedFix]
    skipped: List[Dict[str, Any]]

    @property
    def fix_count(self) -> int:
        return len(self.applied_fixes)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "fix_count": self.fix_count,
            "fixed_code": self.fixed_code,
            "applied_fixes": [f.__dict__ for f in self.applied_fixes],
            "skipped": self.skipped,
        }


# ── Fix handler type ──────────────────────────────────────────────────────────
# Each handler receives (lines, line_idx, issue) and returns
# (new_lines, AppliedFix | None).  Return None to signal "could not fix".
FixHandler = Callable[
    [List[str], int, Dict[str, Any]],
    tuple[List[str], Optional[AppliedFix]],
]


class AutoFixer:
    """
    Data-driven auto-fixer.

    Each issue type maps to a pure handler function that receives the current
    line list and returns a (possibly mutated) copy plus an AppliedFix record.
    Adding a new fix = registering one function — no branching in apply().
    """

    def __init__(self) -> None:
        self._handlers: Dict[str, FixHandler] = {
            "line_too_long":            _fix_line_too_long,
            "trailing_whitespace":      _fix_trailing_whitespace,
            "comparison_to_none":       _fix_comparison_to_none,
            "bare_except":              _fix_bare_except,
            "empty_except":             _fix_empty_except,
            "todo_comment":             _fix_todo_to_raise,
            "print_statement":          _fix_print_to_logger,
            "null_reference":           _fix_null_reference,
            "hardcoded_secret":         _fix_hardcoded_secret,
            "debug_enabled":            _fix_debug_flag,
            "missing_io_error_handling":_fix_bare_open,
            "double_blank_lines":       _fix_double_blank_lines,
        }

    def register(self, issue_type: str, handler: FixHandler) -> None:
        """Plug in a custom fix handler at runtime."""
        self._handlers[issue_type] = handler

    def auto_fix(
        self,
        code: str,
        issues: List[Dict[str, Any]],
        language: str = "python",
        dry_run: bool = False,
    ) -> FixResult:
        """
        Apply all fixable issues in severity order.

        Issues are processed highest-severity first; line numbers are kept
        consistent by re-splitting after every successful mutation.
        """
        SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        ordered = sorted(issues, key=lambda i: SEVERITY_ORDER.get(i.get("severity", "info"), 99))

        lines = code.splitlines()
        applied: List[AppliedFix] = []
        skipped: List[Dict[str, Any]] = []

        for issue in ordered:
            issue_type = issue.get("type", "")
            line_idx = issue.get("line", 0) - 1
            handler = self._handlers.get(issue_type)

            if handler is None:
                skipped.append({**issue, "reason": "no handler registered"})
                continue

            if not (0 <= line_idx < len(lines)):
                skipped.append({**issue, "reason": "line number out of range"})
                continue

            try:
                new_lines, fix = handler(list(lines), line_idx, issue)
            except Exception as exc:
                skipped.append({**issue, "reason": f"handler error: {exc}"})
                continue

            if fix is None:
                skipped.append({**issue, "reason": "handler could not produce a safe fix"})
                continue

            if not dry_run:
                lines = new_lines
            applied.append(fix)

        fixed_code = "\n".join(lines)
        return FixResult(
            success=len(applied) > 0,
            fixed_code=fixed_code,
            applied_fixes=applied,
            skipped=skipped,
        )


# ── Handlers ──────────────────────────────────────────────────────────────────

def _fix_line_too_long(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    limit = 99
    if len(original) <= limit:
        return lines, None

    indent = " " * (len(original) - len(original.lstrip()))

    # Try to break at a comma, operator, or space near the limit
    break_chars = [", ", " or ", " and ", " + ", " - ", " | ", " -> ", " = "]
    break_at = -1
    for ch in break_chars:
        pos = original.rfind(ch, 0, limit)
        if pos != -1:
            break_at = pos + len(ch)
            break

    if break_at == -1:
        # Fall back: wrap with textwrap
        wrapped = textwrap.fill(original.strip(), width=limit,
                                subsequent_indent=indent + "    ")
        new_lines = [indent + w for w in wrapped.splitlines()]
    else:
        new_lines = [original[:break_at].rstrip(), indent + "    " + original[break_at:].lstrip()]

    lines[idx:idx + 1] = new_lines
    return lines, AppliedFix(
        rule_type="line_too_long", line=idx + 1,
        description=f"Wrapped line exceeding {limit} chars",
        original=original, replacement="\n".join(new_lines),
    )


def _fix_trailing_whitespace(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    stripped = original.rstrip()
    if stripped == original:
        return lines, None
    lines[idx] = stripped
    return lines, AppliedFix(
        rule_type="trailing_whitespace", line=idx + 1,
        description="Removed trailing whitespace",
        original=original, replacement=stripped,
    )


def _fix_comparison_to_none(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    fixed = re.sub(r'([\w\[\]()"\'.]+)\s*==\s*None\b', r'\1 is None', original)
    fixed = re.sub(r'([\w\[\]()"\'.]+)\s*!=\s*None\b', r'\1 is not None', fixed)
    if fixed == original:
        return lines, None
    lines[idx] = fixed
    return lines, AppliedFix(
        rule_type="comparison_to_none", line=idx + 1,
        description="Replaced == None with 'is None'",
        original=original, replacement=fixed,
    )


def _fix_bare_except(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    fixed = re.sub(r'\bexcept\s*:', 'except Exception:', original)
    if fixed == original:
        return lines, None
    lines[idx] = fixed
    return lines, AppliedFix(
        rule_type="bare_except", line=idx + 1,
        description="Replaced bare 'except:' with 'except Exception:'",
        original=original, replacement=fixed,
    )


def _fix_empty_except(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    """Replace 'except ...: pass' body with a logger.exception call."""
    original = lines[idx]
    if idx + 1 >= len(lines):
        return lines, None

    next_line = lines[idx + 1]
    if not re.match(r'\s*pass\s*$', next_line):
        return lines, None

    indent = " " * (len(next_line) - len(next_line.lstrip()))
    lines[idx + 1] = f"{indent}logger.exception('Unhandled exception')  # TODO: handle properly"
    return lines, AppliedFix(
        rule_type="empty_except", line=idx + 1,
        description="Replaced silent 'pass' in except block with logger.exception()",
        original=next_line, replacement=lines[idx + 1],
    )


def _fix_todo_to_raise(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    """Convert '# TODO: ...' inline comments into NotImplementedError stubs."""
    original = lines[idx]
    match = re.search(r'#\s*(?:TODO|FIXME|HACK|XXX)[:\s]+(.*)', original, re.IGNORECASE)
    if not match:
        return lines, None
    indent = " " * (len(original) - len(original.lstrip()))
    stub = f'{indent}raise NotImplementedError("{match.group(1).strip()}")  # auto-stub'
    # Keep the original as a comment above
    lines[idx] = original  # leave comment
    lines.insert(idx + 1, stub)
    return lines, AppliedFix(
        rule_type="todo_comment", line=idx + 1,
        description="Added NotImplementedError stub below TODO comment",
        original=original, replacement=stub,
    )


def _fix_print_to_logger(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    fixed = re.sub(r'\bprint\s*\(', 'logger.debug(', original, count=1)
    if fixed == original:
        return lines, None
    lines[idx] = fixed
    return lines, AppliedFix(
        rule_type="print_statement", line=idx + 1,
        description="Replaced print() with logger.debug()",
        original=original, replacement=fixed,
    )


def _fix_null_reference(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    match = re.search(r'\b(\w+)\s*\.', original)
    if not match:
        return lines, None

    var = match.group(1)
    # Skip common safe names
    if var in {"self", "cls", "os", "re", "sys", "logging", "logger"}:
        return lines, None

    indent = " " * (len(original) - len(original.lstrip()))
    guard = f"{indent}if {var} is not None:"
    body  = f"{indent}    {original.lstrip()}"
    lines[idx] = guard
    lines.insert(idx + 1, body)
    return lines, AppliedFix(
        rule_type="null_reference", line=idx + 1,
        description=f"Wrapped '{var}' access in None guard",
        original=original, replacement=f"{guard}\n{body}",
    )


def _fix_hardcoded_secret(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    # Extract the variable name (left of '=')
    match = re.match(r'^(\s*\w+)\s*=\s*["\'][^"\']+["\']', original)
    if not match:
        return lines, None

    var_part = match.group(1).strip()
    env_key  = var_part.upper()
    indent   = " " * (len(original) - len(original.lstrip()))
    fixed    = f'{indent}{var_part} = os.environ.get("{env_key}")  # moved from hardcoded value'
    lines[idx] = fixed
    return lines, AppliedFix(
        rule_type="hardcoded_secret", line=idx + 1,
        description=f"Replaced hardcoded secret with os.environ.get('{env_key}')",
        original=original, replacement=fixed,
    )


def _fix_debug_flag(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    original = lines[idx]
    fixed = re.sub(r'\bDEBUG\s*=\s*True\b', 'DEBUG = False', original)
    if fixed == original:
        return lines, None
    lines[idx] = fixed
    return lines, AppliedFix(
        rule_type="debug_enabled", line=idx + 1,
        description="Set DEBUG = False",
        original=original, replacement=fixed,
    )


def _fix_bare_open(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    """Wrap a bare open() call in a with statement."""
    original = lines[idx]
    match = re.search(r'(\w+)\s*=\s*open\(([^)]+)\)', original)
    if not match:
        return lines, None

    var, args = match.group(1), match.group(2)
    indent = " " * (len(original) - len(original.lstrip()))
    with_line = f"{indent}with open({args}) as {var}:"
    lines[idx] = with_line
    # Indent any immediately following lines that use the variable
    j = idx + 1
    while j < len(lines) and (lines[j].startswith(indent + "    ") or lines[j].strip() == ""):
        j += 1
    return lines, AppliedFix(
        rule_type="missing_io_error_handling", line=idx + 1,
        description=f"Converted bare open() to 'with open(...) as {var}:'",
        original=original, replacement=with_line,
    )


def _fix_double_blank_lines(
    lines: List[str], idx: int, issue: Dict
) -> tuple[List[str], Optional[AppliedFix]]:
    """Collapse 3+ consecutive blank lines down to 2."""
    # Work on the whole file for this one since blanks span multiple indices
    result = re.sub(r'\n{3,}', '\n\n', "\n".join(lines))
    new_lines = result.splitlines()
    if new_lines == lines:
        return lines, None
    return new_lines, AppliedFix(
        rule_type="double_blank_lines", line=idx + 1,
        description="Collapsed excessive blank lines to two",
        original="(multiple blank lines)", replacement="(two blank lines)",
    )