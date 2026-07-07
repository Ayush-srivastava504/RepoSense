"""
Daily hackathon discovery pipeline.

Deliberately separate from index.py (the job crawler): hackathons have
their own sources, their own table, their own deterministic quality gate,
and their own expiry rules. Philosophy (see docs/HACKATHONS.md): crawl
everything, keep only the ~20-50 best *active* listings.

Run locally:
    python hackathon_index.py --dry-run
    python hackathon_index.py --sources devpost unstop_hackathons

Run in prod (cron / EventBridge, once a day):
    python hackathon_index.py
"""

import json
import time
from typing import Dict, List

from processors.hackathon_dedupe import deduplicate
from processors.hackathon_normalizer import normalize_batch
from processors.hackathon_quality import filter_low_quality, score_batch
from processors.hackathon_status import apply_status, is_publicly_visible

from utils import (
    deactivate_stale_hackathons,
    get_logger,
    upsert_hackathons,
    utcnow,
)

log = get_logger("hackathon_pipeline")


def _load_scrapers() -> Dict:

    registry: Dict = {}

    try:
        from scrapers.hackathons.devpost import DevpostScraper
        registry["devpost"] = DevpostScraper
    except ImportError as exc:
        log.warning("devpost scraper unavailable: %s", exc)

    try:
        from scrapers.hackathons.unstop_hackathons import UnstopHackathonScraper
        registry["unstop_hackathons"] = UnstopHackathonScraper
    except ImportError as exc:
        log.warning("unstop_hackathons scraper unavailable: %s", exc)

    return registry


def run_hackathon_pipeline(
    sources: List[str] = None,
    dry_run: bool = False,
) -> Dict:

    started_at = utcnow()
    started = time.time()

    registry = _load_scrapers()
    active_sources = [s for s in (sources or list(registry.keys())) if s in registry]

    log.info("Hackathon pipeline start | sources=%s", active_sources)

    raw: List[Dict] = []
    source_counts: Dict[str, int] = {}

    # One scraper (and one browser instance, where applicable) at a time —
    # same discipline as the job crawler's run_pipeline().
    for key in active_sources:
        try:
            scraper = registry[key]()
            items = scraper.run()
            source_counts[key] = len(items)
            raw.extend(items)
            log.info("%s -> %d raw hackathons", key, len(items))
        except Exception:
            log.exception("%s crashed", key)
            source_counts[key] = 0

    log.info("Total raw hackathons: %d", len(raw))

    normalized = normalize_batch(raw)
    log.info("After normalization: %d", len(normalized))

    deduped = deduplicate(normalized)
    log.info("After dedup: %d", len(deduped))

    scored = score_batch(deduped)

    quality_filtered = filter_low_quality(scored)
    log.info("After quality filter: %d", len(quality_filtered))

    with_status = apply_status(quality_filtered)

    visible = [h for h in with_status if is_publicly_visible(h["status"])]
    log.info("Publicly visible (upcoming/ongoing): %d", len(visible))

    written = 0
    deactivated = 0

    if not dry_run and visible:
        try:
            written = upsert_hackathons(visible)
            deactivated = deactivate_stale_hackathons(days=3)
        except Exception:
            log.exception("PostgreSQL write failed")
    elif dry_run:
        log.info("Dry run enabled, skipping writes")

    elapsed = round(time.time() - started, 1)

    summary = {
        "status": "ok",
        "started_at": started_at,
        "elapsed_sec": elapsed,
        "source_counts": source_counts,
        "raw_total": len(raw),
        "normalized": len(normalized),
        "deduplicated": len(deduped),
        "quality_passed": len(quality_filtered),
        "publicly_visible": len(visible),
        "written_db": written,
        "deactivated_stale": deactivated,
    }

    log.info("Hackathon pipeline done in %.1fs | summary=%s", elapsed, json.dumps(summary))
    return summary


if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--sources", nargs="+", default=None)
    args = parser.parse_args()

    summary = run_hackathon_pipeline(sources=args.sources, dry_run=args.dry_run)
    print(json.dumps(summary, indent=2))
