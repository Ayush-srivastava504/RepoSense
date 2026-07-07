import re
from typing import Dict, List

from utils import get_logger

log = get_logger("hackathon_dedupe")

try:
    from rapidfuzz import fuzz
    FUZZY_BACKEND = "rapidfuzz"
except ImportError:
    import difflib
    FUZZY_BACKEND = "difflib"

TITLE_SIMILARITY_THRESHOLD = 90
ORGANIZER_SIMILARITY_THRESHOLD = 85

# Devpost's quality tends to be the most reliable (structured JSON API,
# validated organizer accounts), so when two sources describe the same
# hackathon, prefer it as the primary record. Otherwise fall back to
# whichever has the higher quality_score.
SOURCE_PRIORITY = {"devpost": 3, "unstop_hackathons": 2}


def deduplicate(hackathons: List[Dict]) -> List[Dict]:

    before = len(hackathons)

    # Exact dedup on source_url first (cheap, catches same-source reruns)
    seen_urls = set()
    unique = []
    for h in hackathons:
        url = h.get("source_url")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        unique.append(h)

    deduped = _fuzzy_dedup(unique)

    log.info("Dedup: %d -> %d hackathons", before, len(deduped))
    return deduped


def _fuzzy_dedup(hackathons: List[Dict]) -> List[Dict]:

    kept: List[Dict] = []

    for h in hackathons:

        merged = False
        norm_title = _normalize_title(h.get("title") or "")

        for existing in kept:

            if _similar(norm_title, _normalize_title(existing.get("title") or "")) >= TITLE_SIMILARITY_THRESHOLD \
                    and _similar(h.get("organizer") or "", existing.get("organizer") or "") >= ORGANIZER_SIMILARITY_THRESHOLD:

                # Duplicate found — keep the higher-priority/higher-quality
                # record, but preserve both sources on the winner.
                sources = set(existing.get("sources") or [])
                sources.update(h.get("sources") or [h.get("source")])
                existing["sources"] = sorted(s for s in sources if s)

                if _priority(h) > _priority(existing):
                    idx = kept.index(existing)
                    h["sources"] = existing["sources"]
                    kept[idx] = h

                merged = True
                break

        if not merged:
            kept.append(h)

    return kept


def _priority(h: Dict) -> int:
    return SOURCE_PRIORITY.get(h.get("source"), 1) * 100 + h.get("quality_score", 0)


def _normalize_title(title: str) -> str:
    title = title.lower()
    title = re.sub(r"\b(20\d{2})\b", "", title)          # strip year
    title = re.sub(r"[^a-z0-9\s]", "", title)             # strip punctuation
    title = re.sub(r"\s+", " ", title).strip()
    return title


def _similar(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if FUZZY_BACKEND == "rapidfuzz":
        return fuzz.ratio(a.lower(), b.lower())
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio() * 100
