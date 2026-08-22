# Pydantic schemas for the LeetCode-style solving system routes.
# Covers submission input and the judge's structured verdict output.
# Kept separate from services/models.py since this is a standalone feature.

from pydantic import BaseModel
from typing import Any, Optional


class SubmissionRequest(BaseModel):
    code: str


class TestResult(BaseModel):
    input: Any
    expected: Any
    actual: Any = None
    passed: bool
    error: Optional[str] = None


class JudgeResponse(BaseModel):
    ok: bool
    all_passed: bool = False
    summary: Optional[str] = None
    error: Optional[str] = None
    results: list[TestResult] = []


class LevelProblemOut(BaseModel):
    slug: str
    title: str
    category: str
    difficulty: str
    leetcode_url: str
    solvable: bool


class LevelSummaryOut(BaseModel):
    key: str
    label: str
    description: str
    count: int


class LevelDetailOut(BaseModel):
    key: str
    label: str
    description: str
    problems: list[LevelProblemOut]
