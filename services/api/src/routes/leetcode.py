# Module: src/routes/leetcode.py
# Defines function(s): get_problems, get_problem_detail, submit_solution, get_levels, get_level_detail, get_companies, download_blind75_sheet
#
#

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from services.leetcode_service import list_problems, get_problem, judge_submission
from dataclasses import asdict
from data.leetcode.level_problems import list_levels, get_level, list_all_companies
from schemas.leetcode import SubmissionRequest, JudgeResponse, LevelSummaryOut, LevelDetailOut
router = APIRouter(prefix='/api/leetcode', tags=['leetcode'])
BLIND75_SHEET_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'leetcode', 'Blind_75_Company_Tags.xlsx')

@router.get('/problems')
async def get_problems():
    return list_problems()

@router.get('/problems/{slug}')
async def get_problem_detail(slug: str):
    problem = get_problem(slug)
    if problem is None:
        raise HTTPException(status_code=404, detail='problem not found')
    return {'slug': problem.slug, 'title': problem.title, 'difficulty': problem.difficulty, 'description': problem.description, 'function_name': problem.function_name, 'starter_code': problem.starter_code}

@router.post('/problems/{slug}/submit', response_model=JudgeResponse)
async def submit_solution(slug: str, submission: SubmissionRequest):
    if get_problem(slug) is None:
        raise HTTPException(status_code=404, detail='problem not found')
    verdict = judge_submission(slug, submission.code)
    return verdict

@router.get('/levels', response_model=list[LevelSummaryOut])
async def get_levels():
    return list_levels()

@router.get('/levels/{level_key}', response_model=LevelDetailOut)
async def get_level_detail(level_key: str):
    level = get_level(level_key)
    if level is None:
        raise HTTPException(status_code=404, detail='level not found')
    return {'key': level['key'], 'label': level['label'], 'description': level['description'], 'problems': [asdict(p) for p in level['problems']]}

@router.get('/companies', response_model=list[str])
async def get_companies():
    return list_all_companies()

@router.get('/blind75/sheet')
async def download_blind75_sheet():
    if not os.path.exists(BLIND75_SHEET_PATH):
        raise HTTPException(status_code=404, detail='sheet not found')
    return FileResponse(BLIND75_SHEET_PATH, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename='Blind_75_Company_Tags.xlsx')
