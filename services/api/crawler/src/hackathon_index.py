# Production hackathon discovery pipeline.
# Runs all registered hackathon sources, normalizes and deduplicates
# listings, applies the quality and active-status gates, writes valid
# hackathons to PostgreSQL, and deactivates stale listings.

import json
import time
from typing import Dict, List, Type
from processors.hackathon_dedupe import deduplicate
from processors.hackathon_normalizer import normalize_batch
from processors.hackathon_quality import filter_low_quality, score_batch
from processors.hackathon_status import apply_status, is_publicly_visible
from scrapers.hackathons.base import BaseHackathonScraper
from utils import deactivate_stale_hackathons, get_logger, upsert_hackathons, utcnow
log = get_logger('hackathon_pipeline')
ScraperRegistry = Dict[str, Type[BaseHackathonScraper]]

def _load_scrapers() -> ScraperRegistry:
    registry: ScraperRegistry = {}
    try:
        from scrapers.hackathons.devpost import DevpostScraper
        registry['devpost'] = DevpostScraper
    except ImportError as exc:
        log.warning('devpost scraper unavailable: %s', exc)
    try:
        from scrapers.hackathons.unstop_hackathons import UnstopHackathonScraper
        registry['unstop_hackathons'] = UnstopHackathonScraper
    except ImportError as exc:
        log.warning('unstop_hackathons scraper unavailable: %s', exc)
    try:
        from scrapers.hackathons.devfolio import DevfolioScraper
        registry['devfolio'] = DevfolioScraper
    except ImportError as exc:
        log.warning('devfolio scraper unavailable: %s', exc)
    try:
        from scrapers.hackathons.hackerearth import HackerEarthScraper
        registry['hackerearth'] = HackerEarthScraper
    except ImportError as exc:
        log.warning('hackerearth scraper unavailable: %s', exc)
    log.info('Loaded hackathon sources: %s', list(registry.keys()))
    return registry

def _run_scrapers(registry: ScraperRegistry) -> tuple[List[Dict], Dict[str, int]]:
    raw: List[Dict] = []
    source_counts: Dict[str, int] = {}
    for source_name, scraper_class in registry.items():
        try:
            log.info('Starting hackathon source: %s', source_name)
            scraper = scraper_class()
            items = scraper.run()
            source_counts[source_name] = len(items)
            raw.extend(items)
            log.info('%s -> %d raw hackathons', source_name, len(items))
        except Exception:
            log.exception('%s scraper crashed', source_name)
            source_counts[source_name] = 0
    return (raw, source_counts)

def _log_status_counts(hackathons: List[Dict]) -> None:
    status_counts: Dict[str, int] = {}
    for hackathon in hackathons:
        status = hackathon.get('status') or 'unknown'
        status_counts[status] = status_counts.get(status, 0) + 1
    log.info('Hackathon status counts: %s', status_counts)

def run_hackathon_pipeline() -> Dict:
    started_at = utcnow()
    started = time.time()
    registry = _load_scrapers()
    if not registry:
        elapsed = round(time.time() - started, 1)
        summary = {'status': 'failed', 'started_at': started_at, 'elapsed_sec': elapsed, 'source_counts': {}, 'raw_total': 0, 'normalized': 0, 'deduplicated': 0, 'quality_passed': 0, 'publicly_visible': 0, 'written_db': 0, 'deactivated_stale': 0}
        log.error('No hackathon scrapers available')
        return summary
    log.info('Hackathon production pipeline start | sources=%s', list(registry.keys()))
    raw, source_counts = _run_scrapers(registry)
    log.info('Total raw hackathons: %d', len(raw))
    normalized = normalize_batch(raw)
    log.info('After normalization: %d', len(normalized))
    deduplicated = deduplicate(normalized)
    log.info('After dedup: %d', len(deduplicated))
    scored = score_batch(deduplicated)
    log.info('After quality scoring: %d', len(scored))
    quality_filtered = filter_low_quality(scored)
    log.info('After quality filter: %d', len(quality_filtered))
    with_status = apply_status(quality_filtered)
    _log_status_counts(with_status)
    visible = [hackathon for hackathon in with_status if is_publicly_visible(hackathon['status'])]
    log.info('Publicly visible (upcoming/ongoing): %d', len(visible))
    written = 0
    deactivated = 0
    if visible:
        try:
            written = upsert_hackathons(visible)
            log.info('Written %d hackathons to PostgreSQL', written)
        except Exception:
            log.exception('PostgreSQL hackathon upsert failed')
    else:
        log.warning('No active hackathons available for PostgreSQL upsert')
    try:
        deactivated = deactivate_stale_hackathons(days=3)
    except Exception:
        log.exception('Failed to deactivate stale hackathons')
    elapsed = round(time.time() - started, 1)
    summary = {'status': 'ok', 'started_at': started_at, 'elapsed_sec': elapsed, 'source_counts': source_counts, 'raw_total': len(raw), 'normalized': len(normalized), 'deduplicated': len(deduplicated), 'quality_passed': len(quality_filtered), 'publicly_visible': len(visible), 'written_db': written, 'deactivated_stale': deactivated}
    log.info('Hackathon production pipeline done in %.1fs | summary=%s', elapsed, json.dumps(summary, default=str))
    return summary

def main() -> None:
    summary = run_hackathon_pipeline()
    print(json.dumps(summary, indent=2, default=str))
if __name__ == '__main__':
    main()
