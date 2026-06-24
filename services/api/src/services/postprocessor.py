# ml/inference/postprocessor.py

from typing import List, Dict, Any

_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
_SEVERITY_WEIGHTS = {"critical": 20, "high": 10, "medium": 5, "low": 2, "info": 0}


class Postprocessor:
    """
    Transforms raw analyser output into a structured, scored report.
    Pure function — no I/O, no side effects, fully testable.
    """

    def process(self, issues: List[Dict[str, Any]], code_length: int) -> Dict[str, Any]:
        issues = self._sort_by_severity(issues)

        severity_breakdown = self._count_by_key(issues, "severity")
        category_breakdown = self._count_by_key(issues, "category")
        total = len(issues)
        score = self._quality_score(issues)

        return {
            "issues": issues,
            "quality_metrics": {
                "lines_of_code": code_length,
                "total_issues": total,
                "issue_density": round(total / max(code_length / 100, 1), 2),
                "severity_breakdown": severity_breakdown,
                "category_breakdown": category_breakdown,
                "quality_score": score,
            },
            "summary": self._build_summary(total, severity_breakdown, score),
        }

    # ── Internals ─────────────────────────────────────────────────────────────

    @staticmethod
    def _sort_by_severity(issues: List[Dict]) -> List[Dict]:
        return sorted(issues, key=lambda i: _SEVERITY_ORDER.get(i.get("severity", "info"), 99))

    @staticmethod
    def _count_by_key(issues: List[Dict], key: str) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for issue in issues:
            val = issue.get(key, "unknown")
            counts[val] = counts.get(val, 0) + 1
        return counts

    @staticmethod
    def _quality_score(issues: List[Dict]) -> int:
        penalty = sum(_SEVERITY_WEIGHTS.get(i.get("severity", "info"), 0) for i in issues)
        return max(0, 100 - penalty)

    @staticmethod
    def _build_summary(total: int, severity_breakdown: Dict[str, int], score: int) -> str:
        if total == 0:
            return "No issues found. Code looks clean."

        critical = severity_breakdown.get("critical", 0)
        high     = severity_breakdown.get("high", 0)
        medium   = severity_breakdown.get("medium", 0)
        low      = severity_breakdown.get("low", 0)

        parts = []
        if critical: parts.append(f"{critical} critical")
        if high:     parts.append(f"{high} high")
        if medium:   parts.append(f"{medium} medium")
        if low:      parts.append(f"{low} low")

        breakdown = ", ".join(parts)
        grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 50 else "D"
        return (
            f"Found {total} issue{'s' if total != 1 else ''} ({breakdown}). "
            f"Quality score: {score}/100 (Grade {grade})."
        )