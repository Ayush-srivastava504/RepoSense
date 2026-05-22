import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from config import JOB_TYPE_MAP, SKILL_ALIASES
from utils import get_logger, utcnow


log = get_logger("normalizer")

CANONICAL_FIELDS = {
    "id": str,
    "title": str,
    "company": str,
    "location": str,
    "type": str,
    "duration": str,
    "stipend": str,
    "salary": str,
    "description": str,
    "requirements": list,
    "skills": list,
    "apply_url": str,
    "source": str,
    "posted_date": str,
    "deadline": str,
    "is_remote": bool,
    "experience_required": str,
    "scraped_at": str,
    "category": str,
    "seniority": str,
    "normalized_location": str,
}


def normalize(
    job: Dict,
) -> Optional[Dict]:

    try:

        normalized = _normalize_single(job)

        return (
            normalized
            if normalized.get("title")
            else None
        )

    except Exception as exc:

        log.warning(
            "Normalization error: %s | job=%s",
            exc,
            job.get("id", "?"),
        )

        return None


def normalize_batch(
    jobs: List[Dict],
) -> List[Dict]:

    results = []

    for job in jobs:

        normalized = normalize(job)

        if normalized:
            results.append(normalized)

    log.info(
        "Normalized %d/%d jobs",
        len(results),
        len(jobs),
    )

    return results


def _normalize_single(
    raw: Dict,
) -> Dict:

    job: Dict[str, Any] = {}

    job["id"] = _str(
        raw.get("id", "")
    )

    job["title"] = _title_case(
        _str(raw.get("title", ""))
    )

    job["company"] = _title_case(
        _str(raw.get("company", ""))
    )

    job["location"] = _normalize_location(
        _str(raw.get("location", ""))
    )

    job["duration"] = _str(
        raw.get("duration", "")
    )

    job["stipend"] = _normalize_money(
        raw.get("stipend", "")
    )

    job["salary"] = _normalize_money(
        raw.get("salary", "")
    )

    job["description"] = _clean_html(
        _str(raw.get("description", ""))
    )

    job["apply_url"] = _str(
        raw.get("apply_url", "")
    ).strip()

    job["source"] = _str(
        raw.get("source", "unknown")
    ).lower()

    job["experience_required"] = _str(
        raw.get(
            "experience_required",
            "",
        )
    )

    job["scraped_at"] = (
        raw.get("scraped_at")
        or utcnow()
    )

    job["posted_date"] = _normalize_date(
        raw.get("posted_date", "")
    )

    job["deadline"] = _normalize_date(
        raw.get("deadline", "")
    )

    raw_type = _str(
        raw.get("type", "")
    ).lower()

    job["type"] = _normalize_type(
        raw_type,
        job["title"],
    )

    is_remote = raw.get(
        "is_remote",
        False,
    )

    if not is_remote:

        is_remote = _detect_remote(
            job["location"]
            + " "
            + job["title"]
        )

    job["is_remote"] = bool(
        is_remote
    )

    job["skills"] = _normalize_skills(
        raw.get("skills", [])
    )

    job["requirements"] = _normalize_requirements(
        raw.get("requirements", [])
    )

    job["category"] = ""

    job["seniority"] = _infer_seniority(
        job["title"],
        job["experience_required"],
    )

    job["normalized_location"] = _city_name(
        job["location"]
    )

    return job


def _str(value) -> str:

    return re.sub(
        r"\s+",
        " ",
        str(value or ""),
    ).strip()


def _clean_html(
    text: str,
) -> str:

    text = re.sub(
        r"<[^>]+>",
        " ",
        text,
    )

    text = re.sub(
        r"&[a-zA-Z]{2,6};",
        " ",
        text,
    )

    return re.sub(
        r"\s+",
        " ",
        text,
    ).strip()


def _title_case(
    text: str,
) -> str:

    if not text:
        return text

    words = text.split()

    result = []

    for word in words:

        if (
            word.isupper()
            and len(word) <= 5
        ):

            result.append(word)

        else:

            result.append(
                word.capitalize()
            )

    return " ".join(result)


def _normalize_location(
    location: str,
) -> str:

    if not location:
        return ""

    location = re.sub(
        r",?\s*india\s*$",
        "",
        location,
        flags=re.I,
    ).strip()

    return location or "India"


CITY_MAP = {
    "bengaluru": "Bangalore",
    "bangalore": "Bangalore",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "mumbai": "Mumbai",
    "bombay": "Mumbai",
    "hyderabad": "Hyderabad",
    "pune": "Pune",
    "chennai": "Chennai",
    "madras": "Chennai",
    "kolkata": "Kolkata",
    "calcutta": "Kolkata",
    "noida": "Noida",
    "gurgaon": "Gurgaon",
    "gurugram": "Gurgaon",
    "remote": "Remote",
}


def _city_name(
    location: str,
) -> str:

    lower = location.lower()

    for key, value in CITY_MAP.items():

        if key in lower:
            return value

    return (
        location.split(",")[0].strip()
        if location
        else ""
    )


def _normalize_date(
    value,
) -> str:

    if not value:
        return ""

    value = str(value).strip()

    if re.match(
        r"\d{4}-\d{2}-\d{2}",
        value,
    ):

        return value[:10]

    if re.match(
        r"^\d{10,13}$",
        value,
    ):

        timestamp = int(value) / (
            1000
            if len(value) == 13
            else 1
        )

        try:

            return datetime.fromtimestamp(
                timestamp,
                tz=timezone.utc,
            ).strftime("%Y-%m-%d")

        except Exception:
            return ""

    match = re.search(
        r"(\d+)\s*day",
        value,
        re.I,
    )

    if match:

        return (
            datetime.now(timezone.utc)
            - timedelta(
                days=int(match.group(1))
            )
        ).strftime("%Y-%m-%d")

    return value[:20]


def _normalize_money(
    value,
) -> str:

    if not value:
        return ""

    text = str(value).strip()

    if re.search(
        r"[₹$€£]|INR|LPA|per",
        text,
        re.I,
    ):

        return text

    if re.match(
        r"^\d+\.?\d*$",
        text,
    ):

        number = float(text)

        if number > 100_000:

            return (
                f"₹{number / 100000:.1f}L"
            )

        return f"₹{number:,.0f}"

    return text


def _normalize_type(
    raw_type: str,
    title: str,
) -> str:

    for key, value in JOB_TYPE_MAP.items():

        if key in raw_type:
            return value

    title = title.lower()

    if "intern" in title:
        return "internship"

    if (
        "contract" in title
        or "freelance" in title
    ):

        return "contract"

    if (
        "part" in title
        and "time" in title
    ):

        return "part-time"

    return "full-time"


def _normalize_skills(
    skills,
) -> List[str]:

    if not skills:
        return []

    if isinstance(skills, str):

        skills = [
            skill.strip()
            for skill in re.split(
                r"[,;|/]",
                skills,
            )
        ]

    normalized = []

    for skill in skills:

        skill = str(skill).strip()

        if not skill:
            continue

        lower = skill.lower()

        canonical = lower

        for (
            canon,
            aliases,
        ) in SKILL_ALIASES.items():

            if (
                lower in aliases
                or lower == canon
            ):

                canonical = canon
                break

        normalized.append(
            canonical.title()
            if len(canonical) > 3
            else canonical.upper()
        )

    return list(
        dict.fromkeys(normalized)
    )


def _normalize_requirements(
    requirements,
) -> List[str]:

    if not requirements:
        return []

    if isinstance(requirements, str):

        return [
            requirement.strip()
            for requirement in re.split(
                r"[\n•·\-]",
                requirements,
            )
            if requirement.strip()
        ]

    return [
        str(requirement).strip()
        for requirement in requirements
        if str(requirement).strip()
    ]


def _detect_remote(
    text: str,
) -> bool:

    return bool(
        re.search(
            r"\bremote\b|\bwfh\b|\bwork.from.home\b",
            text,
            re.I,
        )
    )


def _infer_seniority(
    title: str,
    experience: str,
) -> str:

    text = (
        title
        + " "
        + experience
    ).lower()

    if any(
        word in text
        for word in [
            "intern",
            "trainee",
            "0 year",
            "0-1",
        ]
    ):

        return "intern"

    if any(
        word in text
        for word in [
            "junior",
            "fresher",
            "entry",
            "0-2",
            "1-2",
        ]
    ):

        return "junior"

    if any(
        word in text
        for word in [
            "senior",
            "lead",
            "principal",
            "5+",
            "7+",
        ]
    ):

        return "senior"

    if any(
        word in text
        for word in [
            "manager",
            "director",
            "head",
            "vp",
            "chief",
        ]
    ):

        return "management"

    return "mid-level"