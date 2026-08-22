# API routes for the LeetCode question solving/judging system.
# Exposes problem listing, problem detail, submission grading, and the
# Blind 75 tracker sheet. Delegates execution to services/leetcode_service.py.

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from services.leetcode_service import (
    list_problems, get_problem, judge_submission,
)
from schemas.leetcode import SubmissionRequest, JudgeResponse

router = APIRouter(prefix="/api/leetcode", tags=["leetcode"])

BLIND75_SHEET_PATH = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data", "leetcode", "Blind_75_Company_Tags.xlsx",
)


@router.get("/problems")
async def get_problems():
    return list_problems()


@router.get("/problems/{slug}")
async def get_problem_detail(slug: str):
    problem = get_problem(slug)
    if problem is None:
        raise HTTPException(status_code=404, detail="problem not found")
    return {
        "slug": problem.slug,
        "title": problem.title,
        "difficulty": problem.difficulty,
        "description": problem.description,
        "function_name": problem.function_name,
        "starter_code": problem.starter_code,
    }


@router.post("/problems/{slug}/submit", response_model=JudgeResponse)
async def submit_solution(slug: str, submission: SubmissionRequest):
    if get_problem(slug) is None:
        raise HTTPException(status_code=404, detail="problem not found")
    verdict = judge_submission(slug, submission.code)
    return verdict


@router.get("/blind75/sheet")
async def download_blind75_sheet():
    if not os.path.exists(BLIND75_SHEET_PATH):
        raise HTTPException(status_code=404, detail="sheet not found")
    return FileResponse(
        BLIND75_SHEET_PATH,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="Blind_75_Company_Tags.xlsx",
    )
