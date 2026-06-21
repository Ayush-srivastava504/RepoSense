from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from fastapi.responses import (
    FileResponse,
)

from pydantic import BaseModel

import traceback

from middleware.auth import verify_token

from services.resume_service import (
    ResumeService,
)

from services.resume_ai_service import (
    ResumeAIService,
)

from services.resume_template_service import (
    ResumeTemplateService,
)

from services.resume_pdf_service import (
    ResumePDFService,
)


router = APIRouter(
    prefix="/api/resume",
    tags=["resume"],
)


@router.get("/test")
async def test():
    return {"ok": True}


class ResumeData(BaseModel):
    title: str
    content: dict  # accepts structured JSON from both handwritten and AI tabs


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

        ai_service = (
            ResumeAIService()
        )

        template_service = (
            ResumeTemplateService()
        )

        pdf_service = (
            ResumePDFService()
        )

        structured_data = (
            await ai_service.generate_resume_data(
                data.resume_type,
                data.job_description,
                data.skills,
                data.experience,
            )
        )

        latex_resume = (
            template_service.render_resume(
                structured_data
            )
        )

        pdf_path = (
            await pdf_service.compile_latex(
                "generated_resume",
                latex_resume,
            )
        )

        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename="resume.pdf",
        )

    except Exception as exc:
        # Log the full traceback for debugging purposes.
        traceback.print_exc()

        # Provide a more specific error response when the AI service fails to produce valid JSON.
        if "No JSON found" in str(exc) or "JSON parsing failed" in str(exc):
            raise HTTPException(
                400,
                f"Invalid AI output: {str(exc)}"
            )
        else:
            raise HTTPException(
                500,
                f"Resume generation failed: {str(exc)}"
            )


@router.post("/create")
async def create_resume(
    data: ResumeData,
    user=Depends(verify_token),
):

    try:

        service = ResumeService()

        import json
        content_str = json.dumps(data.content) if isinstance(data.content, dict) else data.content
        return await service.create_resume(
            user["sub"],
            data.title,
            content_str,
        )

    except Exception as exc:

        traceback.print_exc()

        raise HTTPException(
            503,
            f"Database unavailable: {str(exc)}",
        )


@router.get("/list")
async def list_resumes(
    user=Depends(verify_token),
):

    try:

        service = ResumeService()

        return await service.list_resumes(
            user["sub"]
        )

    except Exception as exc:

        traceback.print_exc()

        raise HTTPException(
            503,
            f"Database unavailable: {str(exc)}",
        )