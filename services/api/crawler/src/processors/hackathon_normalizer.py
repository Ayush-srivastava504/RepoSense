import html
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from dateutil import parser as dateparser

from utils import get_logger, make_hackathon_id, make_hackathon_slug

log = get_logger("hackathon_normalizer")


def normalize_batch(raw: List[Dict]) -> List[Dict]:
    normalized = []

    for item in raw:
        try:
            normalized_item = _normalize_one(item)

            if normalized_item:
                normalized.append(normalized_item)

        except Exception:
            log.exception(
                "Failed to normalize hackathon: %r",
                item.get("title"),
            )

    log.info(
        "Normalized %d/%d hackathons",
        len(normalized),
        len(raw),
    )

    return normalized


def _normalize_one(item: Dict) -> Optional[Dict]:
    title = _clean_text(item.get("title")) or ""

    source_url = (
        _clean_text(
            item.get("source_url")
            or item.get("apply_url")
        )
        or ""
    )

    if not title or not source_url:
        return None

    organizer = _clean_text(item.get("organizer"))

    hackathon_id = make_hackathon_id(
        title,
        organizer or "",
        source_url,
    )

    slug = make_hackathon_slug(
        title,
        hackathon_id,
    )

    start_date = _parse_date(
        item.get("start_date")
    )

    end_date = _parse_date(
        item.get("end_date")
    )

    deadline = _parse_relative_or_date(
        item.get("registration_deadline")
    )

    description = (
        _clean_text(item.get("description"))
        or ""
    )

    prize_pool_text = _clean_prize(
        item.get("prize_pool_text")
    )

    return {
        "id": hackathon_id,
        "slug": slug,
        "title": title,
        "organizer": organizer,
        "description": description,
        "participation_mode": _normalize_mode(
            item.get("participation_mode"),
            description,
        ),
        "location": _clean_text(
            item.get("location")
        ),
        "country": _guess_country(
            item.get("location")
        ),
        "is_global": bool(
            item.get("is_global")
        ),
        "is_student_friendly": bool(
            item.get("is_student_friendly")
        ),
        "start_date": start_date,
        "end_date": end_date,
        "registration_deadline": deadline,
        "prize_pool_text": prize_pool_text,
        "prize_value_usd": _extract_prize_usd(
            prize_pool_text
        ),
        "team_size_min": item.get(
            "team_size_min"
        ),
        "team_size_max": item.get(
            "team_size_max"
        ),
        "eligibility": _clean_text(
            item.get("eligibility")
        ),
        "themes": item.get("themes") or [],
        "submission_requirements": (
            item.get("submission_requirements")
            or []
        ),
        "source": item.get("source"),
        "sources": (
            [item.get("source")]
            if item.get("source")
            else []
        ),
        "source_url": source_url,
        "apply_url": (
            _clean_text(item.get("apply_url"))
            or source_url
        ),
        "image_url": item.get("image_url"),
    }


def _clean_text(value) -> Optional[str]:
    if value is None:
        return None

    text = str(value)

    text = html.unescape(text)

    text = re.sub(
        r"<[^>]+>",
        "",
        text,
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    text = text.strip()

    return text or None


def _clean_prize(value) -> Optional[str]:
    text = _clean_text(value)

    if not text:
        return None

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    text = re.sub(
        r"([₹$€£])\s+",
        r"\1",
        text,
    )

    text = text.strip()

    zero_prize_pattern = re.fullmatch(
        r"[₹$€£]?\s*0+(?:\.0+)?",
        text,
    )

    if zero_prize_pattern:
        return None

    return text


def _normalize_mode(
    mode: Optional[str],
    description: str,
) -> Optional[str]:
    if mode in (
        "online",
        "offline",
        "hybrid",
    ):
        return mode

    text = description.lower()

    if "hybrid" in text:
        return "hybrid"

    if (
        "online" in text
        or "virtual" in text
        or "remote" in text
    ):
        return "online"

    if (
        "in-person" in text
        or "onsite" in text
        or "on-site" in text
    ):
        return "offline"

    return None


def _guess_country(
    location: Optional[str],
) -> Optional[str]:
    location = _clean_text(location)

    if not location:
        return None

    location_lower = location.lower()

    if "india" in location_lower:
        return "India"

    if location_lower in (
        "online",
        "worldwide",
        "global",
        "remote",
    ):
        return None

    return location


def _parse_date(value) -> Optional[str]:
    text = _clean_text(value)

    if not text:
        return None

    try:
        parsed = dateparser.parse(
            text,
            fuzzy=False,
        )

        if parsed.tzinfo is None:
            parsed = parsed.replace(
                tzinfo=timezone.utc
            )

        parsed = parsed.astimezone(
            timezone.utc
        )

        return parsed.isoformat()

    except (
        ValueError,
        TypeError,
        OverflowError,
    ):
        return None


def _parse_relative_or_date(
    value,
) -> Optional[str]:
    """
    Parse absolute registration deadlines and
    relative values such as:

    - 4 days left
    - 12 hrs to go
    - 2 hours left

    Unrealistic crawler values are rejected.
    """

    text = _clean_text(value)

    if not text:
        return None

    relative = re.fullmatch(
        (
            r"\s*(\d+)\s*"
            r"(day|days|hour|hours|hr|hrs)"
            r"\s*(left|to go)?\s*"
        ),
        text,
        re.IGNORECASE,
    )

    if relative:
        amount = int(
            relative.group(1)
        )

        unit = relative.group(2).lower()

        if (
            unit.startswith("day")
            and amount > 365
        ):
            log.warning(
                "Rejected unrealistic deadline: %r",
                text,
            )

            return None

        if (
            unit.startswith("hour")
            or unit.startswith("hr")
        ) and amount > 8760:
            log.warning(
                "Rejected unrealistic deadline: %r",
                text,
            )

            return None

        now = datetime.now(
            timezone.utc
        )

        if unit.startswith("day"):
            deadline = now + timedelta(
                days=amount
            )
        else:
            deadline = now + timedelta(
                hours=amount
            )

        return deadline.isoformat()

    parsed = _parse_date(text)

    if not parsed:
        return None

    try:
        parsed_datetime = datetime.fromisoformat(
            parsed
        )

    except ValueError:
        return None

    now = datetime.now(
        timezone.utc
    )

    maximum_deadline = now + timedelta(
        days=1095
    )

    if parsed_datetime > maximum_deadline:
        log.warning(
            "Rejected far-future deadline: %r",
            text,
        )

        return None

    return parsed_datetime.isoformat()


def _extract_prize_usd(
    text: Optional[str],
) -> Optional[float]:
    if not text:
        return None

    match = re.search(
        (
            r"(₹|\$)\s*"
            r"([\d,]+(?:\.\d+)?)"
            r"\s*(lakh|k|cr)?"
        ),
        text,
        re.IGNORECASE,
    )

    if not match:
        return None

    currency = match.group(1)

    amount_str = match.group(2)

    unit = (
        match.group(3)
        or ""
    ).lower()

    try:
        amount = float(
            amount_str.replace(
                ",",
                "",
            )
        )

    except ValueError:
        return None

    if amount <= 0:
        return None

    if unit == "k":
        amount *= 1_000

    elif unit == "lakh":
        amount *= 100_000

    elif unit == "cr":
        amount *= 10_000_000

    if currency == "₹":
        amount /= 83.0

    return round(
        amount,
        2,
    )