from typing import Dict, List
from urllib.parse import urlparse

from utils import get_logger

log = get_logger("hackathon_quality")

MIN_QUALITY_SCORE = 60

SUSPICIOUS_DOMAIN_HINTS = ["bit.ly", "tinyurl", "free-money", "click-here"]
FEE_LANGUAGE_HINTS = ["registration fee", "pay to register", "entry fee of"]


def score_batch(hackathons: List[Dict]) -> List[Dict]:
    for h in hackathons:
        h["quality_score"] = _score_one(h)
        h["trust_score"] = min(100, max(0, h["quality_score"]))
    return hackathons


def filter_low_quality(hackathons: List[Dict], min_score: int = MIN_QUALITY_SCORE) -> List[Dict]:
    kept = [h for h in hackathons if h.get("quality_score", 0) >= min_score]
    log.info(
        "Quality filter: kept %d/%d hackathons (min_score=%d)",
        len(kept), len(hackathons), min_score,
    )
    return kept


def _score_one(h: Dict) -> int:

    score = 50
    apply_url = h.get("apply_url") or ""
    description = h.get("description") or ""

    # Additive signals
    if apply_url:
        score += 10
    if h.get("registration_deadline"):
        score += 10
    if h.get("start_date") and h.get("end_date"):
        score += 5
    if h.get("organizer"):
        score += 5
    if h.get("prize_pool_text"):
        score += 5
    if h.get("eligibility"):
        score += 5
    if len(description) >= 100:
        score += 5
    if apply_url.startswith("https://"):
        score += 5

    # Subtractive signals
    if not h.get("registration_deadline"):
        score -= 15
    if not h.get("organizer"):
        score -= 10
    if len(description) < 100:
        score -= 10
    if _is_suspicious_domain(apply_url):
        score -= 30
    if any(hint in description.lower() for hint in FEE_LANGUAGE_HINTS):
        score -= 15
    if not apply_url:
        score -= 20

    return max(0, min(100, score))


def _is_suspicious_domain(url: str) -> bool:
    if not url:
        return False
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return False
    return any(hint in host for hint in SUSPICIOUS_DOMAIN_HINTS)
