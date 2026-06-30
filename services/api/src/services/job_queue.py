"""
services/api/src/services/job_queue.py

Async job queue for long-running LLM tasks.

Why this exists
---------------
Cloudflare (sitting between browser and Nginx) closes connections that have
no response within ~100 seconds (HTTP 524).  README generation and resume
generation call an on-premise LLM that regularly takes 200-250 seconds.

Pattern
-------
  1. Route handler creates a row in `async_jobs` with status='pending',
     fires asyncio.create_task(run_job(...)), and immediately returns
     {"job_id": "..."} to the frontend (< 1 second).
  2. Worker task runs in the background, updating status to 'running',
     then either 'done' (+ result JSON) or 'failed' (+ error text).
  3. Frontend polls  GET /api/async-jobs/{job_id}  until status ∈ {done, failed}.

No extra infrastructure (Celery, RabbitMQ, Redis queue) is needed because
FastAPI's event loop can run background tasks.  For a heavily loaded system
you would graduate to a proper worker pool, but this removes the 524 timeout
with zero additional dependencies.
"""

from __future__ import annotations

import asyncio
import base64
import traceback
import uuid
from datetime import datetime
from typing import Any

import httpx

from configs.config import settings
from configs.db import get_db_pool


# ── helpers ──────────────────────────────────────────────────────────────────

async def _update_job(pool, job_id: str, **kwargs):
    """Patch one or more columns on the async_jobs row."""
    kwargs["updated_at"] = datetime.utcnow()
    set_clause = ", ".join(
        f"{col} = ${i + 2}" for i, col in enumerate(kwargs)
    )
    values = list(kwargs.values())
    await pool.execute(
        f"UPDATE async_jobs SET {set_clause} WHERE id = $1",
        job_id,
        *values,
    )


# ── public API ───────────────────────────────────────────────────────────────

async def create_job(user_id: str, job_type: str, payload: dict) -> str:
    """Insert a new pending job and return its id."""
    pool = await get_db_pool()
    job_id = str(uuid.uuid4())
    import json as _json
    await pool.execute(
        """
        INSERT INTO async_jobs (id, user_id, type, status, payload)
        VALUES ($1, $2, $3, 'pending', $4)
        """,
        job_id,
        user_id,
        job_type,
        _json.dumps(payload),
    )
    return job_id


async def get_job(job_id: str, user_id: str) -> dict | None:
    """Fetch job row for the owning user (returns None if not found / wrong user)."""
    pool = await get_db_pool()
    row = await pool.fetchrow(
        "SELECT * FROM async_jobs WHERE id = $1 AND user_id = $2",
        job_id,
        user_id,
    )
    if row is None:
        return None
    return dict(row)


# ── workers ──────────────────────────────────────────────────────────────────

async def run_readme_job(job_id: str, user_id: str, github_token: str, repo_name: str):
    """
    Background task: generate README via LLM and commit it to GitHub.
    Updates async_jobs row as it progresses.
    """
    pool = await get_db_pool()
    await _update_job(pool, job_id, status="running")

    try:
        timeout = httpx.Timeout(60.0, connect=30.0)

        # ── 1. Read repo structure ────────────────────────────────────────
        async with httpx.AsyncClient(timeout=timeout) as client:
            contents_resp = await client.get(
                f"https://api.github.com/repos/{repo_name}/contents",
                headers={
                    "Authorization": f"token {github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            contents_resp.raise_for_status()
            contents = contents_resp.json()

        file_names = [item["name"] for item in contents]
        folder_names = [item["name"] for item in contents if item["type"] == "dir"]

        # ── 2. Fetch important files ──────────────────────────────────────
        important_files: list[str] = []
        async with httpx.AsyncClient(timeout=timeout) as client:
            for file_name in [
                "package.json", "requirements.txt", "pyproject.toml",
                "main.py", "app.py", "next.config.js", "Dockerfile",
                "docker-compose.yml", ".env.example",
            ]:
                try:
                    resp = await client.get(
                        f"https://api.github.com/repos/{repo_name}/contents/{file_name}",
                        headers={
                            "Authorization": f"token {github_token}",
                            "Accept": "application/vnd.github.v3.raw",
                        },
                    )
                    if resp.status_code == 200:
                        important_files.append(f"\n===== {file_name} =====\n{resp.text[:1500]}")
                except Exception:
                    pass

        # ── 3. Fetch directory snippets ───────────────────────────────────
        dir_snippets: list[str] = []
        async with httpx.AsyncClient(timeout=timeout) as client:
            for dir_name in ["src", "app", "backend", "frontend", "api"]:
                try:
                    dir_resp = await client.get(
                        f"https://api.github.com/repos/{repo_name}/contents/{dir_name}",
                        headers={
                            "Authorization": f"token {github_token}",
                            "Accept": "application/vnd.github.v3+json",
                        },
                    )
                    if dir_resp.status_code == 200:
                        dir_items = dir_resp.json()
                        for entry in dir_items:
                            if entry["type"] == "file" and entry["name"].split(".")[-1] in (
                                "py", "ts", "tsx", "js", "jsx"
                            ):
                                file_resp = await client.get(
                                    f"https://api.github.com/repos/{repo_name}/contents/{entry['path']}",
                                    headers={
                                        "Authorization": f"token {github_token}",
                                        "Accept": "application/vnd.github.v3.raw",
                                    },
                                )
                                if file_resp.status_code == 200:
                                    dir_snippets.append(
                                        f"\n===== {entry['path']} =====\n{file_resp.text[:1500]}"
                                    )
                                break
                except Exception:
                    pass

        # ── 4. Build prompt ───────────────────────────────────────────────
        prompt = f"""You are a senior software architect and technical documentation engineer.
Generate a production-grade GitHub README.md for the repository below.

Repository: {repo_name}
ROOT FILES: {chr(10).join(file_names)}
ROOT FOLDERS: {chr(10).join(folder_names)}
PROJECT FILES: {chr(10).join(important_files)}
DIRECTORY SNIPPETS: {chr(10).join(dir_snippets)}

CRITICAL:
Never mention a technology unless it appears explicitly in the provided files.
If unsure, omit it.
Return EXACTLY ONE README.
Do not repeat sections.
Do not output multiple versions.

Generate a complete README with:
1. Project title
2. Overview
3. Key features
4. Technology stack
5. Installation
6. Usage
7. Project structure
8. API endpoints (if detected)
9. Environment variables (if detected)
10. License
Output raw markdown only."""

        # ── 5. Call LLM (this is the slow part) ──────────────────────────
        async with httpx.AsyncClient(timeout=httpx.Timeout(900.0, connect=60.0)) as client:
            resp = await client.post(
                f"{settings.NEURAL_GENERATOR_URL}/generate",
                json={
                    "prompt": prompt,
                    "max_tokens": 1200,
                    "temperature": 0.55,
                    "top_k": 50,
                    "top_p": 0.92,
                },
            )
            resp.raise_for_status()
            readme = resp.json().get("text", "").strip()

        # ── 6. Post-process ───────────────────────────────────────────────
        for marker in ["Final Answer", "Alright, I've thoroughly analyzed"]:
            if marker in readme:
                readme = readme.split(marker, 1)[-1]
        readme = readme.replace("```markdown", "").replace("```", "").strip()
        if not readme:
            readme = f"# {repo_name.split('/')[-1]}\n\nREADME generation failed.\n"

        # ── 7. Commit to GitHub ───────────────────────────────────────────
        async with httpx.AsyncClient(timeout=timeout) as client:
            encoded_content = base64.b64encode(readme.encode()).decode()

            existing_resp = await client.get(
                f"https://api.github.com/repos/{repo_name}/contents/README.md",
                headers={
                    "Authorization": f"token {github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
            )
            payload: dict[str, Any] = {
                "message": "Add AI-generated README",
                "content": encoded_content,
            }
            if existing_resp.status_code == 200:
                payload["sha"] = existing_resp.json().get("sha")

            create_resp = await client.put(
                f"https://api.github.com/repos/{repo_name}/contents/README.md",
                headers={
                    "Authorization": f"token {github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                json=payload,
            )
            if create_resp.status_code not in [200, 201]:
                raise RuntimeError(f"Failed to commit README: {create_resp.text}")

        # ── 8. Mark done ──────────────────────────────────────────────────
        import json as _json
        await _update_job(
            pool,
            job_id,
            status="done",
            result=_json.dumps({"readme": readme, "repo": repo_name}),
        )

    except Exception:
        tb = traceback.format_exc()
        print(f"[job_queue] README job {job_id} failed:\n{tb}")
        await _update_job(pool, job_id, status="failed", error=tb[-2000:])


async def run_resume_job(job_id: str, user_id: str, resume_type: str,
                         job_description: str, skills: str, experience: str):
    """
    Background task: generate resume PDF via LLM.
    Stores the resulting PDF path (or base64) in result JSON.
    """
    pool = await get_db_pool()
    await _update_job(pool, job_id, status="running")

    try:
        from services.resume_ai_service import ResumeAIService
        from services.resume_template_service import ResumeTemplateService
        from services.resume_pdf_service import ResumePDFService

        ai_service = ResumeAIService()
        template_service = ResumeTemplateService()
        pdf_service = ResumePDFService()

        structured_data = await ai_service.generate_resume_data(
            resume_type, job_description, skills, experience
        )
        latex_resume = template_service.render_resume(structured_data)
        pdf_path = await pdf_service.compile_latex("generated_resume", latex_resume)

        # Read the PDF and base64-encode so the client can download it
        # without needing a file-server URL.
        with open(pdf_path, "rb") as f:
            pdf_b64 = base64.b64encode(f.read()).decode()

        import json as _json
        await _update_job(
            pool,
            job_id,
            status="done",
            result=_json.dumps({"pdf_b64": pdf_b64}),
        )

    except Exception:
        tb = traceback.format_exc()
        print(f"[job_queue] Resume job {job_id} failed:\n{tb}")
        await _update_job(pool, job_id, status="failed", error=tb[-2000:])

async def run_linkedin_job(job_id: str, user_id: str, unlock_method: str, profile: dict):
    """
    Background task: run the 14-rule engine (instant) then call the LLM for
    qualitative feedback (the slow part). Persists the result to
    linkedin_analyses once done so /linkedin/history works.
    """
    pool = await get_db_pool()
    await _update_job(pool, job_id, status="running")
    try:
        from services.linkedin_rules import run_rules
        from services.linkedin_ai_service import LinkedInAIService
        from services.linkedin_service import LinkedInService

        rule_report = run_rules(profile)
        ai_feedback = await LinkedInAIService().generate_feedback(profile, rule_report)
        analysis_id = await LinkedInService(pool).save_analysis(
            user_id, unlock_method, rule_report, ai_feedback
        )

        import json as _json
        await _update_job(
            pool,
            job_id,
            status="done",
            result=_json.dumps({
                "analysis_id": analysis_id,
                "unlock_method": unlock_method,
                **rule_report,
                "ai_feedback": ai_feedback,
            }),
        )
    except Exception:
        tb = traceback.format_exc()
        print(f"[job_queue] LinkedIn job {job_id} failed:\n{tb}")
        await _update_job(pool, job_id, status="failed", error=tb[-2000:])
