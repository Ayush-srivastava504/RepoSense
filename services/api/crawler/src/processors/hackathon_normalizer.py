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
            n = _normalize_one(item)
            if n:
                normalized.append(n)
        except Exception:
            log.warning("Failed to normalize hackathon: %r", item.get("title"))

    log.info("Normalized %d/%d hackathons", len(normalized), len(raw))
    return normalized


def _normalize_one(item: Dict) -> Optional[Dict]:

    title = (item.get("title") or "").strip()
    source_url = (item.get("source_url") or item.get("apply_url") or "").strip()

    if not title or not source_url:
        return None

    hackathon_id = make_hackathon_id(title, item.get("organizer") or "", source_url)
    slug = make_hackathon_slug(title, hackathon_id)

    start_date = _parse_date(item.get("start_date"))
    end_date = _parse_date(item.get("end_date"))
    deadline = _parse_relative_or_date(item.get("registration_deadline"))

    description = (item.get("description") or "").strip()

    return {
        "id": hackathon_id,
        "slug": slug,
        "title": title,
        "organizer": (item.get("organizer") or "").strip() or None,
        "description": description,
        "participation_mode": _normalize_mode(item.get("participation_mode"), description),
        "location": item.get("location"),
        "country": _guess_country(item.get("location")),
        "is_global": bool(item.get("is_global")),
        "is_student_friendly": bool(item.get("is_student_friendly")),
        "start_date": start_date,
        "end_date": end_date,
        "registration_deadline": deadline,
        "prize_pool_text": item.get("prize_pool_text"),
        "prize_value_usd": _extract_prize_usd(item.get("prize_pool_text")),
        "team_size_min": item.get("team_size_min"),
        "team_size_max": item.get("team_size_max"),
        "eligibility": item.get("eligibility"),
        "themes": item.get("themes") or [],
        "submission_requirements": item.get("submission_requirements") or [],
        "source": item.get("source"),
        "sources": [item.get("source")],
        "source_url": source_url,
        "apply_url": item.get("apply_url") or source_url,
        "image_url": item.get("image_url"),
    }


def _normalize_mode(mode: Optional[str], description: str) -> Optional[str]:
    if mode in ("online", "offline", "hybrid"):
        return mode
    text = description.lower()
    if "hybrid" in text:
        return "hybrid"
    if "online" in text or "virtual" in text or "remote" in text:
        return "online"
    if "in-person" in text or "onsite" in text or "on-site" in text:
        return "offline"
    return None


def _guess_country(location: Optional[str]) -> Optional[str]:
    if not location:
        return None
    location_lower = location.lower()
    if "india" in location_lower:
        return "India"
    if location_lower in ("online", "worldwide", "global", "remote"):
        return None
    return location


def _parse_date(value) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, str):
        try:
            return dateparser.parse(value, fuzzy=True).astimezone(timezone.utc).isoformat()
        except Exception:
            return None
    return None


def _parse_relative_or_date(value) -> Optional[str]:
    """Handles both absolute date strings and site-specific relative
    strings like '4 days left' / '12 hrs to go', which crawler-scraped
    cards frequently show instead of an ISO date."""

    if not value:
        return None

    if not isinstance(value, str):
        return None

    relative = re.search(r"(\d+)\s?(day|hour|hr)s?\s?(left|to go)?", value, re.IGNORECASE)
    if relative:
        amount = int(relative.group(1))
        unit = relative.group(2).lower()
        now = datetime.now(timezone.utc)
        if unit.startswith("day"):
            return (now + timedelta(days=amount)).isoformat()
        return (now + timedelta(hours=amount)).isoformat()

    return _parse_date(value)


def _extract_prize_usd(text: Optional[str]) -> Optional[float]:
    if not text:
        return None

    match = re.search(r"(₹|\$)\s?([\d,]+(?:\.\d+)?)\s?(lakh|k|cr)?", text, re.IGNORECASE)
    if not match:
        return None

    currency, amount_str, unit = match.group(1), match.group(2), (match.group(3) or "").lower()

    try:
        amount = float(amount_str.replace(",", ""))
    except ValueError:
        return None

    if unit == "k":
        amount *= 1_000
    elif unit == "lakh":
        amount *= 100_000
    elif unit == "cr":
        amount *= 10_000_000

    # Rough INR->USD conversion so prize pools from Indian sources (₹) can
    # still be compared against USD prize pools (used only for ranking,
    # never shown to the user — prize_pool_text is what's displayed).
    if currency == "₹":
        amount /= 83.0

    return round(amount, 2)
