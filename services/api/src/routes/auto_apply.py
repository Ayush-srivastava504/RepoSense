import os
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel

from services.auto_apply.ingestion import ProfileIngestionEngine, CandidateProfile
from services.auto_apply.discovery import JobDiscoveryEngine, DiscoveredJob
from services.auto_apply.matching import JobMatchingEngine, MatchResult
from services.auto_apply.application import ApplicationEngine, ApplicationSubmissionResult
from services.auto_apply.tracker import ApplicationTrackerEngine, ApplicationRecord

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auto-apply", tags=["auto-apply"])

ingestion_engine = ProfileIngestionEngine()
discovery_engine = JobDiscoveryEngine()
matching_engine = JobMatchingEngine()
application_engine = ApplicationEngine()
tracker_engine = ApplicationTrackerEngine()

class AutoApplyRunRequest(BaseModel):
    user_id: str = "default_user"
    resume_text: Optional[str] = None
    min_score: float = 65.0
    limit: int = 5
    dry_run: bool = True
    is_remote: Optional[bool] = None
    search_query: Optional[str] = None

class AutoApplyRunResponse(BaseModel):
    total_discovered: int
    matched_count: int
    applied_count: int
    results: List[ApplicationSubmissionResult]

@router.post("/ingest", response_model=CandidateProfile)
async def ingest_resume(
    file: Optional[UploadFile] = File(None),
    raw_text: Optional[str] = Form(None)
):
    """Layer 1 Endpoint: Ingest resume PDF file or text string into structured profile."""
    if file:
        content = await file.read()
        return ingestion_engine.parse_pdf_resume(content, file.filename or "resume.pdf")
    elif raw_text:
        return ingestion_engine.parse_text_to_profile(raw_text)
    else:
        raise HTTPException(status_code=400, detail="Must provide either resume PDF file or raw_text")

@router.post("/discover-and-match")
async def discover_and_match(
    resume_text: str = Form(...),
    min_score: float = Form(65.0),
    limit: int = Form(20)
):
    """Layer 2 & 3 Endpoint: Discover active jobs and compute match rankings."""
    profile = ingestion_engine.parse_text_to_profile(resume_text)
    jobs = await discovery_engine.fetch_database_jobs(limit=limit)
    ranked = matching_engine.filter_and_rank_jobs(profile, jobs, min_score=min_score)

    return [
        {
            "job": job,
            "match": match
        }
        for job, match in ranked
    ]

@router.post("/run", response_model=AutoApplyRunResponse)
async def run_auto_apply_pipeline(req: AutoApplyRunRequest):
    """Full 5-Layer Pipeline Execution Endpoint."""
    # Layer 1: Ingestion
    if req.resume_text:
        profile = ingestion_engine.parse_text_to_profile(req.resume_text)
    else:
        # Fallback candidate profile template
        profile = CandidateProfile(
            full_name="Software Developer Candidate",
            email="candidate@example.com",
            phone="+15550192834",
            skills=["Python", "FastAPI", "React", "TypeScript", "PostgreSQL", "Docker"]
        )

    # Layer 2: Discovery
    discovered_jobs = await discovery_engine.fetch_database_jobs(
        limit=req.limit * 3,
        is_remote=req.is_remote,
        search_query=req.search_query
    )

    # Layer 3: Matching & Ranking
    ranked_jobs = matching_engine.filter_and_rank_jobs(profile, discovered_jobs, min_score=req.min_score)

    results: List[ApplicationSubmissionResult] = []
    applied_count = 0

    # Layer 4 & 5: Application & Tracking
    for job, match in ranked_jobs[:req.limit]:
        # Check deduplication
        if await tracker_engine.is_already_applied(req.user_id, job.id, job.company):
            logger.info(f"Skipping already applied job {job.company} - {job.title}")
            continue

        # Execute application layer
        res = await application_engine.apply_to_job(profile, job, dry_run=req.dry_run)
        results.append(res)
        if res.status in ["APPLIED", "DRY_RUN_SUCCESS"]:
            applied_count += 1

        # Log application record
        record = ApplicationRecord(
            user_id=req.user_id,
            job_id=job.id,
            company=job.company,
            title=job.title,
            status=res.status,
            logs=res.logs,
            screenshot_path=res.screenshot_path
        )
        await tracker_engine.log_application(record)

    return AutoApplyRunResponse(
        total_discovered=len(discovered_jobs),
        matched_count=len(ranked_jobs),
        applied_count=applied_count,
        results=results
    )

@router.get("/history", response_model=List[ApplicationRecord])
async def get_application_history(
    user_id: str = Query("default_user"),
    limit: int = Query(50)
):
    """Layer 5 Endpoint: Retrieve application tracking history."""
    return await tracker_engine.get_application_history(user_id=user_id, limit=limit)
