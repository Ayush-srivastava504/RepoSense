from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import sys
import traceback

from pathlib import Path

from middleware.auth import verify_token

from services.resume_service import ResumeService


api_root = Path(
    __file__
).resolve().parents[2]

sys.path.append(
    str(api_root)
)

from neural_generator.src.app import llm


router = APIRouter(
    prefix="/api/resume",
    tags=["resume"],
)


class ResumeData(BaseModel):
    title: str
    content: str


class GenerateResumeRequest(BaseModel):
    resume_type: str
    job_description: str
    skills: str
    experience: str


@router.post("/generate")
async def generate_resume(
    data: GenerateResumeRequest,
    user=Depends(verify_token),
):

    try:

        if data.resume_type == "internship":

            style_reference = """
AI Engineer | Software Developer | Machine Learning

SUMMARY
Junior AI Engineer and Software Developer experienced in building intelligent systems using machine learning, NLP, and Python-based backend development.

TECHNICAL SKILLS
- Python
- FastAPI
- NLP
- Elasticsearch
- Redis
- Hugging Face
"""

        else:

            style_reference = """
Software Engineer

TECHNICAL SKILLS
- Python
- FastAPI
- React
- PostgreSQL
- Docker
- JWT
- AWS

PROJECTS
- quantified achievements
- realistic metrics
- production systems
"""

        prompt = f"""
Generate a professional ATS-optimized resume.

STYLE REFERENCE:
{style_reference}

CANDIDATE INFO:

Resume Type:
{data.resume_type}

Job Description:
{data.job_description}

Skills:
{data.skills}

Experience:
{data.experience}

STRICT RULES:

- NO placeholders
- NO fake universities
- NO fake companies
- NO markdown
- NO code blocks
- realistic metrics only
- concise bullets
- ATS optimized
- modern formatting
- strong action verbs
- no explanations
- no commentary

Generate sections:

Professional Summary
Technical Skills
Experience
Projects
Education
Certifications
Achievements

Return ONLY the resume.
"""

        output = llm(
            prompt,
            max_tokens=700,
            temperature=0.45,
            top_k=40,
            top_p=0.9,
            repeat_penalty=1.2,
            stop=["</s>"],
        )

        generated_resume = (
            output.get(
                "choices",
                [{}]
            )[0]
            .get("text", "")
            .strip()
        )

        generated_resume = (
            generated_resume
            .replace("```", "")
            .replace("markdown", "")
            .replace("plain-text", "")
            .strip()
        )

        if not generated_resume:

            raise HTTPException(
                500,
                "Empty resume generated"
            )

        return {
            "success": True,
            "resume": generated_resume,
        }

    except Exception as exc:

        traceback.print_exc()

        raise HTTPException(
            500,
            f"Resume generation failed: {str(exc)}"
        )


@router.post("/create")
async def create_resume(
    data: ResumeData,
    user=Depends(verify_token),
):

    svc = ResumeService()

    try:

        return await svc.create_resume(
            user["sub"],
            data.title,
            data.content,
        )

    except Exception as exc:

        traceback.print_exc()

        raise HTTPException(
            503,
            f"Database unavailable: {str(exc)}",
        )


@router.get("/list")
async def list_resumes(
    user=Depends(verify_token)
):

    svc = ResumeService()

    try:

        return await svc.list_resumes(
            user["sub"]
        )

    except Exception as exc:

        traceback.print_exc()

        raise HTTPException(
            503,
            f"Database unavailable: {str(exc)}",
        )