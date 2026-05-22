import json
import os
import time
from concurrent.futures import (
    ThreadPoolExecutor,
    as_completed,
)
from typing import Dict, List, Set

from config import (
    DEFAULT_KEYWORDS,
    DEFAULT_LOCATIONS,
    ENABLED_SCRAPERS,
    MAX_PAGES_PER_SOURCE,
    MAX_WORKERS,
)

from processors.dedupe import (
    deduplicate,
    deduplicate_incremental,
)

from processors.enricher import (
    enrich_batch,
)

from processors.normalizer import (
    normalize_batch,
)

from utils import (
    get_logger,
    save_to_s3,
    upsert_jobs,
    utcnow,
)


log = get_logger("handler")


def _load_scrapers() -> Dict:

    registry: Dict = {}

    try:

        from scrapers.internshala import (
            InternshalaScaper,
        )

        registry["internshala"] = (
            InternshalaScaper
        )

    except ImportError as exc:

        log.warning(
            "internshala scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.linkedin import (
            LinkedInScraper,
        )

        registry["linkedin"] = (
            LinkedInScraper
        )

    except ImportError as exc:

        log.warning(
            "linkedin scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.wellfound import (
            WellfoundScraper,
        )

        registry["wellfound"] = (
            WellfoundScraper
        )

    except ImportError as exc:

        log.warning(
            "wellfound scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.naukri import (
            NaukriScraper,
        )

        registry["naukri"] = (
            NaukriScraper
        )

    except ImportError as exc:

        log.warning(
            "naukri scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.indeed import (
            IndeedScraper,
        )

        registry["indeed"] = (
            IndeedScraper
        )

    except ImportError as exc:

        log.warning(
            "indeed scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.unstop import (
            UnstopScraper,
        )

        registry["unstop"] = (
            UnstopScraper
        )

    except ImportError as exc:

        log.warning(
            "unstop scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.glassdoor import (
            GlassdoorScraper,
        )

        registry["glassdoor"] = (
            GlassdoorScraper
        )

    except ImportError as exc:

        log.warning(
            "glassdoor scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.cutshort import (
            CutshortScraper,
        )

        registry["cutshort"] = (
            CutshortScraper
        )

    except ImportError as exc:

        log.warning(
            "cutshort scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.company_portals import (
            CompanyPortalsScraper,
        )

        registry["company_portals"] = (
            CompanyPortalsScraper
        )

    except ImportError as exc:

        log.warning(
            "company_portals scraper unavailable: %s",
            exc,
        )

    return registry


def run_pipeline(
    keywords: List[str] = None,
    locations: List[str] = None,
    max_pages: int = MAX_PAGES_PER_SOURCE,
    existing_ids: Set[str] = None,
    dry_run: bool = False,
) -> Dict:

    keywords = (
        keywords
        or DEFAULT_KEYWORDS
    )

    locations = (
        locations
        or DEFAULT_LOCATIONS
    )

    # Record start time at the very beginning, not after processing
    started_at = utcnow()
    started = time.time()

    registry = _load_scrapers()

    active_scrapers = [
        scraper
        for scraper in ENABLED_SCRAPERS
        if scraper in registry
    ]

    log.info(
        "Pipeline start | scrapers=%s | keywords=%d | locations=%d | max_pages=%d",
        active_scrapers,
        len(keywords),
        len(locations),
        max_pages,
    )

    raw_jobs: List[Dict] = []

    source_counts: Dict[str, int] = {}

    with ThreadPoolExecutor(
        max_workers=min(
            MAX_WORKERS,
            len(active_scrapers),
        )
    ) as pool:

        futures = {
            pool.submit(
                _run_scraper,
                registry[key](),
                keywords,
                locations,
                max_pages,
            ): key
            for key in active_scrapers
        }

        for future in as_completed(
            futures
        ):

            key = futures[future]

            try:

                jobs = future.result()

                source_counts[key] = len(
                    jobs
                )

                raw_jobs.extend(jobs)

                log.info(
                    "%s -> %d raw jobs",
                    key,
                    len(jobs),
                )

            except Exception as exc:

                log.error(
                    "%s crashed: %s",
                    key,
                    exc,
                    exc_info=True,
                )

                source_counts[key] = 0

    log.info(
        "Total raw jobs collected: %d",
        len(raw_jobs),
    )

    normalized = normalize_batch(
        raw_jobs
    )

    log.info(
        "After normalization: %d",
        len(normalized),
    )

    if existing_ids:

        deduped = (
            deduplicate_incremental(
                normalized,
                existing_ids,
            )
        )

    else:

        deduped = deduplicate(
            normalized
        )

    log.info(
        "After deduplication: %d",
        len(deduped),
    )

    enriched = enrich_batch(
        deduped
    )

    log.info(
        "Enriched %d jobs",
        len(enriched),
    )

    written = 0

    s3_key = ""

    if (
        not dry_run
        and enriched
    ):

        try:

            s3_key = save_to_s3(
                enriched,
                source="pipeline",
            )

        except Exception as exc:

            log.error(
                "S3 write failed: %s",
                exc,
            )

        try:

            written = upsert_jobs(
                enriched
            )

        except Exception as exc:

            log.error(
                "DynamoDB write failed: %s",
                exc,
            )

    elif dry_run:

        log.info(
            "Dry run enabled, skipping writes",
        )

    elapsed = round(
        time.time() - started,
        1,
    )

    summary = {
        "status": "ok",
        "started_at": started_at,
        "elapsed_sec": elapsed,
        "source_counts": source_counts,
        "raw_total": len(raw_jobs),
        "normalized": len(normalized),
        "deduplicated": len(deduped),
        "enriched": len(enriched),
        "written_db": written,
        "s3_key": s3_key,
    }

    log.info(
        "Pipeline done in %.1fs | summary=%s",
        elapsed,
        json.dumps(summary),
    )

    return summary


def _run_scraper(
    scraper,
    keywords,
    locations,
    max_pages,
) -> List[Dict]:

    return scraper.run(
        keywords=keywords,
        locations=locations,
        max_pages=max_pages,
    )


def lambda_handler(
    event: Dict,
    context,
) -> Dict:

    log.info(
        "Lambda invoked | event=%s",
        json.dumps(event),
    )

    if "scrapers" in event:

        os.environ[
            "ENABLED_SCRAPERS"
        ] = ",".join(
            event["scrapers"]
        )

        import importlib
        import config

        importlib.reload(config)

    summary = run_pipeline(
        keywords=event.get(
            "keywords"
        ),
        locations=event.get(
            "locations"
        ),
        max_pages=int(
            event.get(
                "max_pages",
                MAX_PAGES_PER_SOURCE,
            )
        ),
        dry_run=bool(
            event.get(
                "dry_run",
                False,
            )
        ),
    )

    return {
        "statusCode": 200,
        "body": json.dumps(summary),
    }


if __name__ == "__main__":

    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--dry-run",
        action="store_true",
    )

    parser.add_argument(
        "--max-pages",
        type=int,
        default=3,
    )

    parser.add_argument(
        "--scrapers",
        nargs="+",
        default=None,
    )

    parser.add_argument(
        "--keywords",
        nargs="+",
        default=None,
    )

    parser.add_argument(
        "--locations",
        nargs="+",
        default=None,
    )

    args = parser.parse_args()

    if args.scrapers:

        os.environ[
            "ENABLED_SCRAPERS"
        ] = ",".join(
            args.scrapers
        )

    summary = run_pipeline(
        keywords=args.keywords,
        locations=args.locations,
        max_pages=args.max_pages,
        dry_run=args.dry_run,
    )

    print(
        json.dumps(
            summary,
            indent=2,
        )
    )