import asyncio
import json
import traceback
from typing import List, Optional, Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from middleware.auth import verify_token
from services.resume_service import ResumeService
from services.resume_ai_service import ResumeAIService
from services.resume_template_service import ResumeTemplateService
from services.resume_pdf_service import ResumePDFService
from services.job_queue import create_job, run_resume_job

router = APIRouter(prefix="/api/resume", tags=["resume"])


class ResumeData(BaseModel):
    title: str
    content: dict

class GenerateResumeRequest(BaseModel):
    resume_type: str
    job_description: str
    skills: str
    experience: str

class ExperienceEntry(BaseModel):
    company: str
    role: str
    start: str
    end: str
    location: Optional[str] = ""
    bullets: List[str] = []

class EducationEntry(BaseModel):
    institution: str
    degree: str
    year: str

class ProjectEntry(BaseModel):
    title: str
    tech: str
    github: Optional[str] = ""
    bullets: List[str] = []

class CertificationEntry(BaseModel):
    name: str
    issuer: Optional[str] = ""
    year: Optional[str] = ""

class TechnicalSkills(BaseModel):
    languages: Optional[str] = ""
    ai_ml: Optional[str] = ""
    backend: Optional[str] = ""
    databases: Optional[str] = ""
    tools: Optional[str] = ""

class GenerateStructuredRequest(BaseModel):
    title: str
    name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    summary: str
    githubUrl: Optional[str] = ""
    websiteUrl: Optional[str] = ""
    skills: Optional[str] = ""                          # kept for backward compat
    technical_skills: Optional[TechnicalSkills] = None  # new structured skills
    experience: List[ExperienceEntry] = []
    education: List[EducationEntry] = []
    projects: List[ProjectEntry] = []
    achievements: List[str] = []
    certifications: List[CertificationEntry] = []


@router.get("/test")
async def test():
    return {"ok": True}


@router.post("/generate")
async def generate_resume(data: GenerateResumeRequest, user=Depends(verify_token)):
    job_id = await create_job(
        user_id=user["sub"],
        job_type="resume",
        payload={
            "resume_type": data.resume_type,
            "job_description": data.job_description,
            "skills": data.skills,
            "experience": data.experience,
        },
    )
    asyncio.create_task(
        run_resume_job(
            job_id=job_id,
            user_id=user["sub"],
            resume_type=data.resume_type,
            job_description=data.job_description,
            skills=data.skills,
            experience=data.experience,
        )
    )
    return {"job_id": job_id, "status": "pending"}


def _strip_protocol(url: str) -> str:
    if not url:
        return ""
    return url.replace("https://", "").replace("http://", "").rstrip("/")


@router.post("/generate-structured")
async def generate_structured_resume(data: GenerateStructuredRequest, user=Depends(verify_token)):
    try:
        template_service = ResumeTemplateService()
        pdf_service = ResumePDFService()

        email = data.email or user.get("email", "")

        # If new structured skills provided use them, else fall back to flat skills string
        if data.technical_skills:
            skills_dict = {
                "languages": data.technical_skills.languages or "",
                "ai_ml":     data.technical_skills.ai_ml or "",
                "backend":   data.technical_skills.backend or "",
                "databases": data.technical_skills.databases or "",
                "tools":     data.technical_skills.tools or "",
            }
        else:
            skills_dict = {
                "languages": data.skills or "",
                "ai_ml":     "",
                "backend":   "",
                "databases": "",
                "tools":     "",
            }

        structured_data = {
            "name":            data.name or data.title,
            "email":           email,
            "phone":           data.phone,
            "github_url":      data.githubUrl,
            "github_display":  _strip_protocol(data.githubUrl),
            "website_url":     data.websiteUrl,
            "website_display": _strip_protocol(data.websiteUrl),
            "summary":         data.summary,
            "technical_skills": skills_dict,
            "experience": [
                {
                    "company":  exp.company,
                    "role":     exp.role,
                    "duration": f"{exp.start} – {exp.end}".strip(" –") if exp.start or exp.end else "",
                    "location": exp.location or "",
                    "bullets":  [b for b in exp.bullets if b.strip()],
                }
                for exp in data.experience
            ],
            "education": [
                {
                    "institution": edu.institution,
                    "degree":      edu.degree,
                    "year":        edu.year,
                }
                for edu in data.education
            ],
            "projects": [
                {
                    "title":   proj.title,
                    "tech":    proj.tech,
                    "github":  proj.github or "",
                    "bullets": [b for b in proj.bullets if b.strip()],
                }
                for proj in data.projects
            ],
            "achievements": [a for a in data.achievements if a.strip()],
            "certifications": [
                {"name": c.name, "issuer": c.issuer or "", "year": c.year or ""}
                for c in data.certifications
                if c.name.strip()
            ],
        }

        latex_resume = template_service.render_resume(structured_data)
        pdf_path = await pdf_service.compile_latex("structured_resume", latex_resume)
        return FileResponse(pdf_path, media_type="application/pdf", filename="resume.pdf")

    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(500, f"PDF generation failed: {str(exc)}")


@router.post("/create")
async def create_resume(data: ResumeData, user=Depends(verify_token)):
    try:
        service = ResumeService()
        content_str = json.dumps(data.content) if isinstance(data.content, dict) else data.content
        return await service.create_resume(user["sub"], data.title, content_str)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(503, f"Database unavailable: {str(exc)}")


@router.get("/list")
async def list_resumes(user=Depends(verify_token)):
    try:
        service = ResumeService()
        return await service.list_resumes(user["sub"])
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(503, f"Database unavailable: {str(exc)}")