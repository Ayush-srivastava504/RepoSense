import json
import os
import time
from typing import Dict, List, Set

from config import (
    DEFAULT_KEYWORDS,
    DEFAULT_LOCATIONS,
    ENABLED_SCRAPERS,
    MAX_PAGES_PER_SOURCE,
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

from processors.trust import (
    score_batch,
)

from utils import (
    get_logger,
    save_to_s3,
    upsert_jobs,
    deactivate_stale_jobs,
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

        from scrapers.hiringcafe import (
            HiringCafeScraper,
        )

        registry["hiringcafe"] = (
            HiringCafeScraper
        )

    except ImportError as exc:

        log.warning(
            "hiringcafe scraper unavailable: %s",
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

    # --- Remote Jobs section (Remote OK, We Work Remotely, Remotive,
    # HiringCafe). Naukri/Indeed/Glassdoor/Wellfound were removed entirely
    # — heavy anti-bot protection (login walls, aggressive rate-limiting,
    # frequent markup churn) meant they cost more crawl budget than the
    # jobs they reliably yielded. HiringCafe (see scrapers/hiringcafe.py)
    # is wired in as their remote-jobs replacement. Himalayas was also
    # removed entirely (both this and europe_himalayas below) — it was
    # consistently returning 0 jobs.

    try:

        from scrapers.remoteok import (
            RemoteOKScraper,
        )

        registry["remoteok"] = (
            RemoteOKScraper
        )

    except ImportError as exc:

        log.warning(
            "remoteok scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.weworkremotely import (
            WeWorkRemotelyScraper,
        )

        registry["weworkremotely"] = (
            WeWorkRemotelyScraper
        )

    except ImportError as exc:

        log.warning(
            "weworkremotely scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.remotive import (
            RemotiveScraper,
        )

        registry["remotive"] = (
            RemotiveScraper
        )

    except ImportError as exc:

        log.warning(
            "remotive scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.japan_jobs import (
            JapanJobsScraper,
        )

        registry["japan_jobs"] = (
            JapanJobsScraper
        )

    except ImportError as exc:

        log.warning(
            "japan_jobs scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.japan_internships import (
            JapanInternshipsScraper,
        )

        registry["japan_internships"] = (
            JapanInternshipsScraper
        )

    except ImportError as exc:

        log.warning(
            "japan_internships scraper unavailable: %s",
            exc,
        )

    # --- Europe section (Jobicy, Arbeitnow, Remotive, We Work Remotely,
    #     Remote OK, each client/server-filtered for Europe). Himalayas
    #     was removed entirely — consistently returned 0 jobs.

    _europe_scrapers = [
        ("europe_jobicy", "scrapers.europe_jobicy", "EuropeJobicyScraper"),
        ("europe_arbeitnow", "scrapers.europe_arbeitnow", "EuropeArbeitnowScraper"),
        ("europe_remotive", "scrapers.europe_remotive", "EuropeRemotiveScraper"),
        ("europe_weworkremotely", "scrapers.europe_weworkremotely", "EuropeWeWorkRemotelyScraper"),
        ("europe_remoteok", "scrapers.europe_remoteok", "EuropeRemoteOKScraper"),
    ]

    for _source_name, _module_name, _class_name in _europe_scrapers:

        try:

            _module = __import__(
                _module_name,
                fromlist=[_class_name],
            )

            registry[_source_name] = getattr(_module, _class_name)

        except ImportError as exc:

            log.warning(
                "%s scraper unavailable: %s",
                _source_name,
                exc,
            )

    # --- Government Jobs section (Employment News, FreeJobAlert)

    try:

        from scrapers.employment_news import (
            EmploymentNewsScraper,
        )

        registry["employment_news"] = (
            EmploymentNewsScraper
        )

    except ImportError as exc:

        log.warning(
            "employment_news scraper unavailable: %s",
            exc,
        )

    try:

        from scrapers.freejobalert import (
            FreeJobAlertScraper,
        )

        registry["freejobalert"] = (
            FreeJobAlertScraper
        )

    except ImportError as exc:

        log.warning(
            "freejobalert scraper unavailable: %s",
            exc,
        )

    # --- ATS "smart crawlers" section (Greenhouse, Lever, Ashby,
    # SmartRecruiters, Workable). Each is one shared fetch/parse module
    # (scrapers/ats_common.py) driven by the company/board token list in
    # config.ATS_COMPANIES — growing coverage is a config change, not new
    # scraper code. Jobvite/iCIMS/Teamtailor don't have one consistent
    # public API across companies, so they (plus non-ATS sites like
    # JapanDev/TokyoDev/GradConnection/Prosple/WayUp) go through
    # generic_boards instead (see scrapers/generic_boards.py).

    _ats_scrapers = [
        ("greenhouse", "scrapers.greenhouse", "GreenhouseScraper"),
        ("lever", "scrapers.lever", "LeverScraper"),
        ("ashby", "scrapers.ashby", "AshbyScraper"),
        ("smartrecruiters", "scrapers.smartrecruiters", "SmartRecruitersScraper"),
        ("workable", "scrapers.workable", "WorkableScraper"),
    ]

    for _source_name, _module_name, _class_name in _ats_scrapers:

        try:

            _module = __import__(
                _module_name,
                fromlist=[_class_name],
            )

            registry[_source_name] = getattr(_module, _class_name)

        except ImportError as exc:

            log.warning(
                "%s scraper unavailable: %s",
                _source_name,
                exc,
            )

    try:

        from scrapers.generic_boards import (
            GenericBoardsScraper,
        )

        registry["generic_boards"] = (
            GenericBoardsScraper
        )

    except ImportError as exc:

        log.warning(
            "generic_boards scraper unavailable: %s",
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

    enabled_scrapers = [
        s.strip()
        for s in os.getenv(
            "ENABLED_SCRAPERS",
            ",".join(ENABLED_SCRAPERS),
        ).split(",")
        if s.strip()
    ]

    active_scrapers = [
        scraper
        for scraper in enabled_scrapers
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

    # Run one scraper at a time — no parallel browsers, no ThreadPoolExecutor.
    # Each scraper gets its own single Chromium instance (see BaseScraper.run),
    # fully closed before the next scraper starts.
    for key in active_scrapers:

        try:

            scraper = registry[key]()

            jobs = _run_scraper(
                scraper,
                keywords,
                locations,
                max_pages,
            )

            source_counts[key] = len(jobs)

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

    enriched = score_batch(
        enriched
    )

    written = 0

    s3_key = ""

    deactivated = 0

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

            log.info(
                "Attempting to insert %d jobs into PostgreSQL",
                len(enriched),
            )

            written = upsert_jobs(
                enriched
            )

            log.info(
                "Successfully inserted %d jobs into PostgreSQL",
                written,
            )

        except Exception:

            log.exception(
                "PostgreSQL write failed"
            )

        try:

            # Rank/de-rank: anything the crawler hasn't re-confirmed in
            # 30 days (a still-listed job would have been re-seen and
            # its last_seen_at refreshed by upsert_jobs above) gets
            # deactivated and drops out of all public listings.
            deactivated = deactivate_stale_jobs(
                days=30
            )

        except Exception:

            log.exception(
                "Stale job deactivation failed"
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
        "deactivated_stale": deactivated,
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
            [
                s.strip()
                for s in event["scrapers"]
                if s.strip()
            ]
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

        scraper_list = []

        for item in args.scrapers:

            scraper_list.extend(
                [
                    s.strip()
                    for s in item.split(",")
                    if s.strip()
                ]
            )

        os.environ[
            "ENABLED_SCRAPERS"
        ] = ",".join(
            scraper_list
        )

        log.info(
            "Using scrapers: %s",
            os.environ[
                "ENABLED_SCRAPERS"
            ],
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