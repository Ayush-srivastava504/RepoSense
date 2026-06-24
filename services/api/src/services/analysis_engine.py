import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class Issue:
    category: str        # security | bug | quality | performance | style
    type: str
    severity: str        # critical | high | medium | low | info
    message: str
    suggestion: str
    confidence: float
    line: int
    col: int = 0
    snippet: str = ""
    cwe: Optional[str] = None   # e.g. "CWE-798"
    pep8: Optional[str] = None  # e.g. "E501"

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class PatternRule:
    id: str
    category: str
    type: str
    severity: str
    pattern: str
    message: str
    suggestion: str
    confidence: float
    flags: int = re.IGNORECASE
    multiline: bool = False
    cwe: Optional[str] = None
    pep8: Optional[str] = None
    languages: Optional[List[str]] = None   # None = all languages


# ── Rule Registry ─────────────────────────────────────────────────────────────

RULES: List[PatternRule] = [

    # ── Security ─────────────────────────────────────────────────────────────

    PatternRule(
        id="SEC001",
        category="security", type="hardcoded_secret", severity="critical",
        pattern=r'(?:password|passwd|pwd)\s*=\s*["\'][^"\']{3,}["\']',
        message="Hardcoded password detected",
        suggestion="Store credentials in environment variables or a secrets manager",
        confidence=0.95, cwe="CWE-798",
    ),
    PatternRule(
        id="SEC002",
        category="security", type="hardcoded_secret", severity="critical",
        pattern=r'(?:api[_-]?key|apikey|access[_-]?token|auth[_-]?token)\s*=\s*["\'][^"\']{8,}["\']',
        message="Hardcoded API key or token detected",
        suggestion="Use environment variables; rotate the exposed key immediately",
        confidence=0.95, cwe="CWE-798",
    ),
    PatternRule(
        id="SEC003",
        category="security", type="hardcoded_secret", severity="critical",
        pattern=r'(?:secret[_-]?key|private[_-]?key|client[_-]?secret)\s*=\s*["\'][^"\']{8,}["\']',
        message="Hardcoded secret key detected",
        suggestion="Move to environment variables or a vault",
        confidence=0.95, cwe="CWE-798",
    ),
    PatternRule(
        id="SEC004",
        category="security", type="sql_injection", severity="critical",
        pattern=r'(?:execute|query|raw)\s*\(\s*[f"\'].*?(?:\+|\%s|\{)',
        message="Possible SQL injection via string formatting",
        suggestion="Use parameterised queries or an ORM",
        confidence=0.80, cwe="CWE-89",
    ),
    PatternRule(
        id="SEC005",
        category="security", type="command_injection", severity="critical",
        pattern=r'(?:os\.system|subprocess\.call|subprocess\.run|eval|exec)\s*\(\s*(?:f["\']|\w+\s*\+)',
        message="Possible command/code injection",
        suggestion="Avoid dynamic shell commands; use subprocess with a list and shell=False",
        confidence=0.80, cwe="CWE-78",
    ),
    PatternRule(
        id="SEC006",
        category="security", type="insecure_deserialization", severity="high",
        pattern=r'\bpickle\.loads?\s*\(|yaml\.load\s*\([^,)]+\)',
        message="Insecure deserialization (pickle/yaml.load without Loader)",
        suggestion="Use yaml.safe_load(); avoid pickle on untrusted data",
        confidence=0.85, cwe="CWE-502",
    ),
    PatternRule(
        id="SEC007",
        category="security", type="weak_hash", severity="high",
        pattern=r'hashlib\.(md5|sha1)\s*\(',
        message="Weak hashing algorithm (MD5/SHA1) detected",
        suggestion="Use SHA-256 or bcrypt/argon2 for passwords",
        confidence=0.90, cwe="CWE-327",
    ),
    PatternRule(
        id="SEC008",
        category="security", type="hardcoded_ip", severity="medium",
        pattern=r'["\'](?:\d{1,3}\.){3}\d{1,3}["\']',
        message="Hardcoded IP address detected",
        suggestion="Move host configuration to environment variables",
        confidence=0.75, cwe="CWE-1051",
    ),
    PatternRule(
        id="SEC009",
        category="security", type="debug_enabled", severity="medium",
        pattern=r'\bDEBUG\s*=\s*True\b',
        message="Debug mode enabled",
        suggestion="Disable DEBUG in production; use environment-based config",
        confidence=0.95, cwe="CWE-215",
    ),
    PatternRule(
        id="SEC010",
        category="security", type="ssl_disabled", severity="high",
        pattern=r'verify\s*=\s*False',
        message="SSL/TLS verification disabled",
        suggestion="Always verify SSL certificates in production",
        confidence=0.90, cwe="CWE-295",
    ),
    PatternRule(
        id="SEC011",
        category="security", type="xss_risk", severity="high",
        pattern=r'innerHTML\s*=\s*(?!`[^`]*`\s*$)',
        message="Possible XSS via innerHTML assignment",
        suggestion="Use textContent or sanitise input with DOMPurify",
        confidence=0.75, cwe="CWE-79",
    ),

    # ── Bugs ─────────────────────────────────────────────────────────────────

    PatternRule(
        id="BUG001",
        category="bug", type="null_reference", severity="critical",
        pattern=r'(?:None|null|undefined)\s*\.',
        message="Potential null/None dereference",
        suggestion="Add a null check or use optional chaining (?.) before accessing member",
        confidence=0.85, cwe="CWE-476",
    ),
    PatternRule(
        id="BUG002",
        category="bug", type="bare_except", severity="high",
        pattern=r'except\s*:',
        message="Bare except clause swallows all exceptions including KeyboardInterrupt",
        suggestion="Catch specific exception types, e.g. except ValueError:",
        confidence=0.95,
    ),
    PatternRule(
        id="BUG003",
        category="bug", type="mutable_default_arg", severity="high",
        pattern=r'def\s+\w+\s*\([^)]*=\s*(?:\[\]|\{\}|\(\))[^)]*\)',
        message="Mutable default argument (list/dict/set) is shared across calls",
        suggestion="Use None as default and initialise inside the function body",
        confidence=0.90,
    ),
    PatternRule(
        id="BUG004",
        category="bug", type="missing_io_error_handling", severity="high",
        pattern=r'(?<!\bwith\b.{0,60})\bopen\s*\(',
        message="File opened without a context manager or error handling",
        suggestion="Use 'with open(...) as f:' to ensure the file is always closed",
        confidence=0.80,
    ),
    PatternRule(
        id="BUG005",
        category="bug", type="unchecked_return", severity="medium",
        pattern=r'(?:os\.remove|os\.rename|shutil\.\w+)\s*\([^)]+\)(?!\s*$|\s*#)',
        message="Return value of file operation not checked",
        suggestion="Wrap in try/except OSError to handle permission or missing-file errors",
        confidence=0.75,
    ),
    PatternRule(
        id="BUG006",
        category="bug", type="integer_division", severity="medium",
        pattern=r'\b\d+\s*\/\s*\d+\b',
        message="Integer division may produce unexpected float (Python 3) or truncate (other langs)",
        suggestion="Use // for explicit integer division or ensure float operands if a fraction is needed",
        confidence=0.65,
    ),
    PatternRule(
        id="BUG007",
        category="bug", type="infinite_loop_risk", severity="high",
        pattern=r'\bwhile\s+True\b(?![^:]*break)',
        message="while True loop with no visible break statement",
        suggestion="Ensure there is a reachable break or return to avoid an infinite loop",
        confidence=0.70,
    ),
    PatternRule(
        id="BUG008",
        category="bug", type="comparison_to_none", severity="low",
        pattern=r'(?:==|!=)\s*None\b',
        message="Comparison to None using == or !=",
        suggestion="Use 'is None' or 'is not None' for identity comparison",
        confidence=0.95,
    ),
    PatternRule(
        id="BUG009",
        category="bug", type="string_concat_in_loop", severity="medium",
        pattern=r'for\b.+\n(?:.*\n){0,3}.*\+=\s*["\']',
        message="String concatenation inside a loop (O(n²) complexity)",
        suggestion="Collect parts in a list and join at the end: ''.join(parts)",
        confidence=0.70, multiline=True,
    ),

    # ── Performance ───────────────────────────────────────────────────────────

    PatternRule(
        id="PERF001",
        category="performance", type="nested_loop_query", severity="high",
        pattern=r'for\b.+\n(?:.*\n){0,5}.*(?:\.query\(|\.filter\(|execute\()',
        message="Database query inside a loop (N+1 problem)",
        suggestion="Batch the query outside the loop or use eager loading / bulk fetch",
        confidence=0.75, multiline=True,
    ),
    PatternRule(
        id="PERF002",
        category="performance", type="repeated_split", severity="low",
        pattern=r'\.split\(.*?\)\[',
        message="Splitting a string just to index the result",
        suggestion="Use str.partition() or a single regex for better readability and speed",
        confidence=0.70,
    ),
    PatternRule(
        id="PERF003",
        category="performance", type="global_import_in_function", severity="low",
        pattern=r'def\s+\w+[^:]*:\n(?:.*\n){0,5}\s+import\s+',
        message="Import statement inside a function body",
        suggestion="Move imports to the top of the module unless lazy-loading is intentional",
        confidence=0.80, multiline=True,
    ),
    PatternRule(
        id="PERF004",
        category="performance", type="isinstance_tuple", severity="low",
        pattern=r'isinstance\s*\(.*?,\s*\w+\)\s*or\s+isinstance\s*\(',
        message="Multiple isinstance() calls that can be combined",
        suggestion="Use isinstance(x, (TypeA, TypeB)) with a tuple instead",
        confidence=0.85,
    ),

    # ── Quality ───────────────────────────────────────────────────────────────

    PatternRule(
        id="QUA001",
        category="quality", type="todo_comment", severity="info",
        pattern=r'#\s*(?:TODO|FIXME|HACK|XXX)\b',
        message="TODO/FIXME marker left in code",
        suggestion="Resolve or track the issue in your project management tool",
        confidence=0.99,
    ),
    PatternRule(
        id="QUA002",
        category="quality", type="print_statement", severity="low",
        pattern=r'^\s*print\s*\(',
        message="print() statement found (likely debug output)",
        suggestion="Replace with structured logging (logging.info / logger.debug)",
        confidence=0.85,
    ),
    PatternRule(
        id="QUA003",
        category="quality", type="magic_number", severity="low",
        pattern=r'(?<!["\'\w])(?<!\.)\b(?!0\b|1\b)(?:\d{2,})\b(?!["\'\w])',
        message="Magic number detected",
        suggestion="Extract into a named constant for clarity and maintainability",
        confidence=0.65,
    ),
    PatternRule(
        id="QUA004",
        category="quality", type="empty_except", severity="high",
        pattern=r'except[^:]*:\s*\n\s*pass\b',
        message="Exception silently swallowed with pass",
        suggestion="At minimum log the exception; re-raise if you cannot handle it",
        confidence=0.95, multiline=True,
    ),
    PatternRule(
        id="QUA005",
        category="quality", type="commented_code", severity="info",
        pattern=r'^\s*#\s*(?:def |class |if |for |while |return |import )',
        message="Commented-out code block detected",
        suggestion="Remove dead code; use version control (git) to track history",
        confidence=0.80,
    ),
    PatternRule(
        id="QUA006",
        category="quality", type="deep_nesting", severity="medium",
        pattern=r'(?:    ){4,}(?:if|for|while|with|try)\b',
        message="Deeply nested block (4+ levels of indentation)",
        suggestion="Extract inner logic into helper functions or use guard clauses / early returns",
        confidence=0.85,
    ),
    PatternRule(
        id="QUA007",
        category="quality", type="unused_import", severity="low",
        pattern=r'^import\s+(\w+)(?!\s*as)',
        message="Potentially unused bare import",
        suggestion="Remove unused imports or use 'import x as x' if it's intentional",
        confidence=0.60, pep8="F401",
    ),

    # ── Style ─────────────────────────────────────────────────────────────────

    PatternRule(
        id="STY001",
        category="style", type="line_too_long", severity="low",
        pattern=r'^.{101,}$',
        message="Line exceeds 100 characters",
        suggestion="Break the line; use parentheses for implicit line continuation",
        confidence=1.0, pep8="E501",
    ),
    PatternRule(
        id="STY002",
        category="style", type="trailing_whitespace", severity="info",
        pattern=r'[ \t]+$',
        message="Trailing whitespace",
        suggestion="Configure your editor to strip trailing whitespace on save",
        confidence=1.0, pep8="W291",
    ),
    PatternRule(
        id="STY003",
        category="style", type="missing_space_around_operator", severity="info",
        pattern=r'(?<!\s)[+\-*/%]=(?!\s)',
        message="Missing spaces around compound assignment operator",
        suggestion="Add spaces: x += 1 not x+=1",
        confidence=0.80, pep8="E225",
    ),
    PatternRule(
        id="STY004",
        category="style", type="camel_case_variable", severity="info",
        pattern=r'\b[a-z]+[A-Z]\w*\s*=',
        message="camelCase variable name (non-Pythonic)",
        suggestion="Use snake_case for variable names per PEP 8",
        confidence=0.75, pep8="N806", languages=["python"],
    ),
    PatternRule(
        id="STY005",
        category="style", type="double_blank_lines", severity="info",
        pattern=r'\n{3,}',
        message="More than two consecutive blank lines",
        suggestion="PEP 8 allows at most two blank lines between top-level definitions",
        confidence=0.90, pep8="E303",
    ),
]


# ── Analyser ──────────────────────────────────────────────────────────────────

class CodeAnalyzer:
    """
    Pure pattern-based static analyser.

    Rules are data-driven (PatternRule dataclasses), making it trivial to add,
    disable, or tune individual checks without touching analysis logic.
    """

    def __init__(self, rules: Optional[List[PatternRule]] = None):
        self._rules = rules or RULES

    # ── Public API ────────────────────────────────────────────────────────────

    def analyze(
        self,
        code: str,
        language: str = "python",
        focus_areas: Optional[List[str]] = None,
        min_confidence: float = 0.0,
        severity_filter: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Analyse *code* and return a list of issue dicts sorted by severity.

        Args:
            code:             Source code string.
            language:         Language hint ("python", "javascript", …).
            focus_areas:      Restrict to these categories, e.g. ["security", "bug"].
            min_confidence:   Drop issues below this threshold (0.0–1.0).
            severity_filter:  Only include these severities, e.g. ["critical", "high"].
        """
        lines = code.splitlines()
        issues: List[Issue] = []
        seen: set = set()  # deduplicate identical (rule_id, line) pairs

        active_rules = self._filter_rules(language, focus_areas)

        for rule in active_rules:
            if rule.confidence < min_confidence:
                continue

            flags = rule.flags
            if rule.multiline:
                flags |= re.MULTILINE | re.DOTALL

            try:
                compiled = re.compile(rule.pattern, flags)
            except re.error as exc:
                logger.warning("Rule %s has invalid pattern: %s", rule.id, exc)
                continue

            if rule.multiline:
                for match in compiled.finditer(code):
                    line_no = code[: match.start()].count("\n") + 1
                    self._add_issue(issues, seen, rule, line_no, lines, match)
            else:
                for line_no, line_text in enumerate(lines, 1):
                    match = compiled.search(line_text)
                    if match:
                        self._add_issue(issues, seen, rule, line_no, lines, match)

        issues = self._apply_filters(issues, min_confidence, severity_filter)
        issues.sort(key=lambda i: self._severity_rank(i.severity))
        return [i.to_dict() for i in issues]

    def summary(self, issues: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return a high-level summary of an analyze() result."""
        by_severity: Dict[str, int] = {}
        by_category: Dict[str, int] = {}
        for issue in issues:
            by_severity[issue["severity"]] = by_severity.get(issue["severity"], 0) + 1
            by_category[issue["category"]] = by_category.get(issue["category"], 0) + 1
        return {
            "total": len(issues),
            "by_severity": by_severity,
            "by_category": by_category,
            "score": self._quality_score(issues),
        }

    # ── Internals ─────────────────────────────────────────────────────────────

    def _filter_rules(
        self, language: str, focus_areas: Optional[List[str]]
    ) -> List[PatternRule]:
        result = []
        for rule in self._rules:
            if rule.languages and language.lower() not in rule.languages:
                continue
            if focus_areas and rule.category not in focus_areas:
                continue
            result.append(rule)
        return result

    @staticmethod
    def _add_issue(
        issues: List[Issue],
        seen: set,
        rule: PatternRule,
        line_no: int,
        lines: List[str],
        match: re.Match,
    ) -> None:
        key = (rule.id, line_no)
        if key in seen:
            return
        seen.add(key)

        snippet = lines[line_no - 1].strip() if line_no <= len(lines) else ""
        issues.append(Issue(
            category=rule.category,
            type=rule.type,
            severity=rule.severity,
            message=rule.message,
            suggestion=rule.suggestion,
            confidence=rule.confidence,
            line=line_no,
            col=match.start() - (sum(len(l) + 1 for l in lines[: line_no - 1])) if not rule.multiline else 0,
            snippet=snippet[:120],
            cwe=rule.cwe,
            pep8=rule.pep8,
        ))

    @staticmethod
    def _apply_filters(
        issues: List[Issue],
        min_confidence: float,
        severity_filter: Optional[List[str]],
    ) -> List[Issue]:
        result = []
        for issue in issues:
            if issue.confidence < min_confidence:
                continue
            if severity_filter and issue.severity not in severity_filter:
                continue
            result.append(issue)
        return result

    _SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}

    @classmethod
    def _severity_rank(cls, severity: str) -> int:
        return cls._SEVERITY_ORDER.get(severity, 99)

    @staticmethod
    def _quality_score(issues: List[Dict[str, Any]]) -> int:
        """
        Naive 0-100 score.  Penalise by severity weight.
        """
        weights = {"critical": 20, "high": 10, "medium": 5, "low": 2, "info": 0}
        penalty = sum(weights.get(i["severity"], 0) for i in issues)
        return max(0, 100 - penalty)