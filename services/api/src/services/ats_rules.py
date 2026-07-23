
from __future__ import annotations

import re
from typing import Any, Dict, List

RULE_WEIGHTS = {
    "contact_info":        6,
    "section_headers":     8,
    "no_tables_columns":   8,
    "action_verbs":        8,
    "quantified_impact":  12,
    "bullet_length":        6,
    "file_length":          6,
    "role_keyword_match":  30,
    "skills_section":      10,
    "education_section":    6,
}
# sums to 100

ACTION_VERBS = {
    "built", "led", "designed", "implemented", "developed", "created",
    "optimized", "reduced", "increased", "automated", "architected",
    "deployed", "launched", "improved", "migrated", "scaled", "shipped",
    "engineered", "refactored", "debugged", "integrated", "managed",
    "mentored", "analyzed", "delivered", "streamlined", "owned",
}

EXPECTED_SECTIONS = [
    ("experience", ["experience", "work history", "employment"]),
    ("projects", ["projects", "personal projects"]),
    ("education", ["education", "academic"]),
    ("skills", ["skills", "technical skills", "technologies"]),
]

TABLE_MARKERS = ["│", "┃", "\t\t", "|--", "+---"]

ROLE_KEYWORDS: Dict[str, Dict[str, List[str]]] = {
    "software_engineer": {
        "label": "Software Engineer",
        "core": [
            "data structures", "algorithms", "object-oriented", "rest api",
            "git", "unit testing", "ci/cd", "sql", "system design",
            "microservices", "debugging", "agile",
        ],
        "stack": [
            "java", "python", "javascript", "typescript", "c++", "go",
            "react", "node.js", "spring", "django", "docker", "kubernetes",
        ],
    },
    "ai_engineer": {
        "label": "AI/ML Engineer",
        "core": [
            "machine learning", "deep learning", "model training",
            "model evaluation", "fine-tuning", "inference", "mlops",
            "feature engineering", "neural network", "nlp", "computer vision",
        ],
        "stack": [
            "python", "pytorch", "tensorflow", "huggingface", "transformers",
            "scikit-learn", "langchain", "llm", "cuda", "mlflow", "pandas",
        ],
    },
    "devops_engineer": {
        "label": "DevOps Engineer",
        "core": [
            "ci/cd", "infrastructure as code", "monitoring", "automation",
            "incident response", "load balancing", "container orchestration",
            "high availability", "logging", "on-call",
        ],
        "stack": [
            "docker", "kubernetes", "terraform", "ansible", "aws", "azure",
            "gcp", "jenkins", "github actions", "prometheus", "grafana",
            "linux",
        ],
    },
    "data_engineer": {
        "label": "Data Engineer",
        "core": [
            "etl", "data pipeline", "data warehouse", "data modeling",
            "batch processing", "stream processing", "data quality",
            "orchestration", "schema design",
        ],
        "stack": [
            "sql", "python", "spark", "airflow", "kafka", "dbt", "snowflake",
            "redshift", "bigquery", "hadoop", "aws glue",
        ],
    },
    "data_analyst": {
        "label": "Data Analyst",
        "core": [
            "data analysis", "dashboard", "reporting", "data visualization",
            "statistical analysis", "a/b testing", "kpi", "trend analysis",
            "stakeholder", "insights",
        ],
        "stack": [
            "sql", "excel", "power bi", "tableau", "python", "pandas",
            "looker", "google analytics", "r",
        ],
    },
}


def list_roles() -> List[Dict[str, str]]:
    return [
        {"id": role_id, "label": data["label"]}
        for role_id, data in ROLE_KEYWORDS.items()
    ]


def score_resume(resume_text: str, role: str) -> Dict[str, Any]:
    if role not in ROLE_KEYWORDS:
        raise ValueError(f"Unsupported role: {role}")

    text = resume_text or ""
    lower = text.lower()
    word_count = len(re.findall(r"\b\w+\b", text))

    checks: List[Dict[str, Any]] = []

    # --- contact info -----------------------------------------------
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text))
    has_phone = bool(re.search(r"(\+?\d[\d\s\-()]{8,}\d)", text))
    passed = has_email and has_phone
    checks.append(_check(
        "contact_info", "Contact information",
        passed,
        "Email and phone number both found." if passed else
        "Missing an email or phone number an ATS can parse into contact fields.",
        "Put your email and phone number as plain text at the top — not inside an image or text box.",
    ))

    # --- section headers ----------------------------------------------
    found_sections = []
    for _key, aliases in EXPECTED_SECTIONS:
        if any(alias in lower for alias in aliases):
            found_sections.append(_key)
    passed = len(found_sections) >= 3
    checks.append(_check(
        "section_headers", "Standard section headers",
        passed,
        f"Found {len(found_sections)}/4 standard sections (experience, projects, education, skills).",
        "Use plain section headers like 'Experience' and 'Skills' — ATS parsers look for these exact words.",
    ))

    # --- tables / columns -----------------------------------------
    passed = not any(marker in text for marker in TABLE_MARKERS)
    checks.append(_check(
        "no_tables_columns", "No tables or multi-column layout",
        passed,
        "No table/column artifacts detected." if passed else
        "Detected characters typical of tables or multi-column layouts, which many ATS parsers scramble.",
        "Stick to a single-column layout — tables and text boxes often get parsed out of order or dropped.",
    ))

    # --- action verbs -----------------------------------------------
    verbs_found = {v for v in ACTION_VERBS if re.search(rf"\b{re.escape(v)}\b", lower)}
    passed = len(verbs_found) >= 5
    checks.append(_check(
        "action_verbs", "Strong action verbs",
        passed,
        f"Found {len(verbs_found)} distinct strong action verbs (e.g. {', '.join(list(verbs_found)[:3]) or 'none'}).",
        "Start bullets with action verbs like 'built', 'led', 'optimized' instead of 'responsible for'.",
    ))

    # --- quantified impact -----------------------------------------
    numbers = re.findall(r"\b\d+[%xX]?\b", text)
    passed = len(numbers) >= 3
    checks.append(_check(
        "quantified_impact", "Quantified impact",
        passed,
        f"Found {len(numbers)} numeric values in bullets/results." if numbers else
        "No numbers found — bullets read as duties, not measurable impact.",
        "Add numbers where you can: users served, % improved, time saved, scale handled.",
    ))

    # --- bullet length -----------------------------------------------
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    bullet_lines = [ln for ln in lines if ln.startswith(("-", "•", "*")) or re.match(r"^\d+[.)]", ln)]
    long_bullets = [b for b in bullet_lines if len(b.split()) > 30]
    passed = bool(bullet_lines) and len(long_bullets) <= max(1, len(bullet_lines) // 4)
    checks.append(_check(
        "bullet_length", "Concise bullet points",
        passed,
        f"{len(long_bullets)}/{len(bullet_lines) or 0} bullets run over ~30 words.",
        "Keep bullets to one line where possible — long bullets get truncated in ATS previews.",
    ))

    # --- length ------------------------------------------------------
    passed = 250 <= word_count <= 900
    checks.append(_check(
        "file_length", "Resume length",
        passed,
        f"~{word_count} words.",
        "Aim for roughly 400–700 words (about one page for early-career roles).",
    ))

    # --- role keyword match ------------------------------------------
    role_data = ROLE_KEYWORDS[role]
    all_keywords = role_data["core"] + role_data["stack"]
    matched = [kw for kw in all_keywords if kw in lower]
    missing = [kw for kw in all_keywords if kw not in lower]
    match_ratio = len(matched) / len(all_keywords) if all_keywords else 0
    passed = match_ratio >= 0.35
    checks.append(_check(
        "role_keyword_match", f"{role_data['label']} keyword match",
        passed,
        f"Matched {len(matched)}/{len(all_keywords)} keywords recruiters and ATS filters search for in {role_data['label']} resumes.",
        "Work the missing keywords into your bullets naturally — don't just list them once at the bottom.",
        extra={"matched": matched, "missing": missing},
    ))

    # --- skills section -----------------------------------------------
    passed = "skill" in lower
    checks.append(_check(
        "skills_section", "Dedicated skills section",
        passed,
        "Skills section found." if passed else "No dedicated skills section detected.",
        "Add a 'Skills' section listing your tools and languages — ATS keyword matching weighs this heavily.",
    ))

    # --- education section ---------------------------------------------
    passed = any(alias in lower for alias in EXPECTED_SECTIONS[2][1])
    checks.append(_check(
        "education_section", "Education section",
        passed,
        "Education section found." if passed else "No education section detected.",
        "Add an Education section with your degree, institution, and graduation year.",
    ))

    total_score = sum(
        RULE_WEIGHTS[c["id"]] for c in checks if c["passed"]
    )

    return {
        "role": role,
        "role_label": role_data["label"],
        "score": total_score,
        "max_score": 100,
        "word_count": word_count,
        "checks": checks,
        "matched_keywords": matched,
        "missing_keywords": missing,
    }


def _check(
    check_id: str,
    label: str,
    passed: bool,
    detail: str,
    tip: str,
    extra: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    result = {
        "id": check_id,
        "label": label,
        "weight": RULE_WEIGHTS[check_id],
        "passed": passed,
        "detail": detail,
        "tip": tip,
    }
    if extra:
        result.update(extra)
    return result
