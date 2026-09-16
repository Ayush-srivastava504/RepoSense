import re
import logging
from typing import List, Dict, Any, Set
from pydantic import BaseModel, Field
from .ingestion import CandidateProfile
from .discovery import DiscoveredJob

logger = logging.getLogger(__name__)

class MatchResult(BaseModel):
    job_id: str
    job_title: str
    company: str
    overall_score: float = Field(ge=0, le=100)
    keyword_score: float = 0.0
    title_score: float = 0.0
    matched_skills: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    is_recommended: bool = False
    rationale: str = ""

class JobMatchingEngine:
    """Layer 3: Matching & Filtering Engine."""

    def __init__(self, default_min_score: float = 65.0):
        self.default_min_score = default_min_score

    def evaluate_match(self, profile: CandidateProfile, job: DiscoveredJob) -> MatchResult:
        """Score candidate profile against job posting."""
        cand_skills: Set[str] = {s.lower() for s in profile.skills}

        # Extract required skills from job
        job_skills: Set[str] = {s.lower() for s in job.required_skills}
        if not job_skills and job.description:
            # Token search in description against candidate skills
            for skill in cand_skills:
                if re.search(r'\b' + re.escape(skill) + r'\b', job.description, re.IGNORECASE):
                    job_skills.add(skill)

        # 1. Skill Match Scoring
        matched = cand_skills.intersection(job_skills)
        missing = job_skills.difference(cand_skills)

        if job_skills:
            keyword_score = (len(matched) / len(job_skills)) * 100.0
        else:
            # Fallback: check how many of candidate's skills appear anywhere in title/description
            matched_fallback = set()
            job_text = f"{job.title} {job.description}".lower()
            for skill in cand_skills:
                if skill in job_text:
                    matched_fallback.add(skill)
            matched = matched_fallback
            keyword_score = min(100.0, (len(matched) / max(1, len(cand_skills))) * 120.0)

        # 2. Title & Role Match Scoring
        title_lower = job.title.lower()
        title_score = 50.0

        # High priority tech roles
        common_roles = ['software', 'engineer', 'developer', 'frontend', 'backend', 'fullstack', 'data', 'python', 'react']
        title_matches = sum(1 for role in common_roles if role in title_lower)
        if title_matches > 0:
            title_score = min(100.0, 50.0 + title_matches * 20.0)

        # Seniority penalty if student/junior profile applies to Principal/Staff/VP
        if any(senior in title_lower for senior in ['staff', 'principal', 'director', 'vp', 'head of']):
            title_score *= 0.5

        # 3. Location / Remote Compatibility
        location_score = 100.0
        if not job.is_remote and profile.location:
            if profile.location.lower() not in job.location.lower():
                location_score = 70.0  # slight penalty for non-local hybrid/onsite

        # 4. Overall Weighted Score
        overall_score = round(
            (0.55 * keyword_score) + (0.35 * title_score) + (0.10 * location_score), 1
        )

        is_recommended = overall_score >= self.default_min_score

        matched_list = sorted([s.capitalize() for s in matched])
        missing_list = sorted([s.capitalize() for s in missing])

        rationale = (
            f"Matched {len(matched_list)} key skills ({', '.join(matched_list[:5])}). "
            f"Skill score: {round(keyword_score, 1)}%. Title match: {round(title_score, 1)}%."
        )

        return MatchResult(
            job_id=job.id,
            job_title=job.title,
            company=job.company,
            overall_score=overall_score,
            keyword_score=round(keyword_score, 1),
            title_score=round(title_score, 1),
            matched_skills=matched_list,
            missing_skills=missing_list,
            is_recommended=is_recommended,
            rationale=rationale
        )

    def filter_and_rank_jobs(
        self,
        profile: CandidateProfile,
        jobs: List[DiscoveredJob],
        min_score: float = 65.0
    ) -> List[tuple[DiscoveredJob, MatchResult]]:
        """Evaluate, rank, and filter list of jobs for a given candidate profile."""
        results = []
        for job in jobs:
            match_res = self.evaluate_match(profile, job)
            if match_res.overall_score >= min_score:
                results.append((job, match_res))

        # Sort descending by overall_score
        results.sort(key=lambda item: item[1].overall_score, reverse=True)
        return results
