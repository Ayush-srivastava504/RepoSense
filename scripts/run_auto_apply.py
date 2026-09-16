#!/usr/bin/env python3
"""
CLI Runner for RepoSense Auto-Apply 5-Layer Pipeline.
Usage:
    python scripts/run_auto_apply.py --resume resume.pdf --min-score 70 --limit 3 --dry-run
"""

import sys
import os
import asyncio
import argparse
import logging

# Ensure services/api/src is in Python path
API_SRC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "api", "src"))
if API_SRC_DIR not in sys.path:
    sys.path.insert(0, API_SRC_DIR)

from services.auto_apply.ingestion import ProfileIngestionEngine, CandidateProfile
from services.auto_apply.discovery import JobDiscoveryEngine, DiscoveredJob
from services.auto_apply.matching import JobMatchingEngine
from services.auto_apply.application import ApplicationEngine
from services.auto_apply.tracker import ApplicationTrackerEngine, ApplicationRecord

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("run_auto_apply")

async def main():
    parser = argparse.ArgumentParser(description="RepoSense Automated Job Application Pipeline CLI")
    parser.add_argument("--resume", type=str, help="Path to resume PDF or TXT file")
    parser.add_argument("--min-score", type=float, default=65.0, help="Minimum match score threshold (default 65.0)")
    parser.add_argument("--limit", type=int, default=5, help="Maximum applications to process (default 5)")
    parser.add_argument("--live", action="store_true", help="Execute live form submissions (default is dry-run)")
    parser.add_argument("--query", type=str, help="Search query filter for job titles/descriptions")

    args = parser.parse_args()
    dry_run = not args.live

    logger.info("=== RepoSense Automated Job Application Pipeline ===")
    logger.info(f"Mode: {'DRY RUN (Preview)' if dry_run else 'LIVE SUBMISSION'}")
    logger.info(f"Min Match Score: {args.min_score}% | Limit: {args.limit}")

    # Layer 1: Ingestion
    ingestion = ProfileIngestionEngine()
    if args.resume and os.path.exists(args.resume):
        logger.info(f"Parsing resume file: {args.resume}")
        with open(args.resume, "rb") as f:
            pdf_bytes = f.read()
        profile = ingestion.parse_pdf_resume(pdf_bytes, file_name=args.resume)
    else:
        logger.info("No valid resume file provided. Utilizing sample developer candidate profile.")
        profile = CandidateProfile(
            full_name="Alex Developer",
            email="alex.dev@example.com",
            phone="+1 (555) 019-2834",
            skills=["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker", "Git"]
        )

    logger.info(f"Parsed Candidate: {profile.full_name} | Email: {profile.email} | Skills ({len(profile.skills)}): {', '.join(profile.skills[:6])}")

    # Layer 2: Discovery
    discovery = JobDiscoveryEngine()
    logger.info("Discovering active job postings...")
    jobs = await discovery.fetch_database_jobs(limit=args.limit * 3, search_query=args.query)

    if not jobs:
        logger.info("No active jobs found in database feed. Creating sample ATS test job...")
        jobs = [
            DiscoveredJob(
                id="test_gh_1",
                title="Full Stack Software Engineer",
                company="TechCorp Solutions",
                location="Remote / San Francisco",
                is_remote=True,
                apply_url="https://boards.greenhouse.io/embed/job_app?for=demo&token=sample_job_1",
                ats_type="greenhouse",
                required_skills=["Python", "React", "PostgreSQL"],
                description="Looking for an experienced Full Stack Software Engineer proficient in Python, FastAPI, React, and SQL databases."
            )
        ]

    logger.info(f"Discovered {len(jobs)} active jobs.")

    # Layer 3: Matching & Ranking
    matching = JobMatchingEngine()
    ranked_jobs = matching.filter_and_rank_jobs(profile, jobs, min_score=args.min_score)

    logger.info(f"Matching complete: {len(ranked_jobs)} jobs passed the score threshold (>= {args.min_score}%).")
    for idx, (job, match) in enumerate(ranked_jobs[:args.limit], 1):
        logger.info(f" [{idx}] {job.company} - {job.title} | Match Score: {match.overall_score}% | ATS: {job.ats_type}")
        logger.info(f"     Rationale: {match.rationale}")

    # Layer 4 & 5: Application & Tracking
    application = ApplicationEngine()
    tracker = ApplicationTrackerEngine()

    logger.info("\nStarting Application Execution Phase...")

    for idx, (job, match) in enumerate(ranked_jobs[:args.limit], 1):
        logger.info(f"\n--- Processing Job [{idx}/{min(len(ranked_jobs), args.limit)}]: {job.company} - {job.title} ---")

        if await tracker.is_already_applied("cli_user", job.id, job.company):
            logger.info(f"Skipping: Already applied to {job.company} within past 60 days.")
            continue

        result = await application.apply_to_job(profile, job, dry_run=dry_run)
        logger.info(f"Result Status: {result.status} | Form Type: {result.form_type}")
        if result.screenshot_path:
            logger.info(f"Screenshot Captured: {result.screenshot_path}")

        # Log to DB
        record = ApplicationRecord(
            user_id="cli_user",
            job_id=job.id,
            company=job.company,
            title=job.title,
            status=result.status,
            logs=result.logs,
            screenshot_path=result.screenshot_path
        )
        await tracker.log_application(record)

    logger.info("\n=== Auto-Apply Pipeline Execution Complete ===")

if __name__ == "__main__":
    asyncio.run(main())
