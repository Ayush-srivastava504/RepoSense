# services/api/src/services/job_queue.py
# Async job queue for long-running LLM tasks.
# Why this exists
# ---------------

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

async def _update_job(pool, job_id: str, **kwargs):
    kwargs['updated_at'] = datetime.utcnow()
    set_clause = ', '.join((f'{col} = ${i + 2}' for i, col in enumerate(kwargs)))
    values = list(kwargs.values())
    await pool.execute(f'UPDATE async_jobs SET {set_clause} WHERE id = $1', job_id, *values)

async def create_job(user_id: str, job_type: str, payload: dict) -> str:
    pool = await get_db_pool()
    job_id = str(uuid.uuid4())
    import json as _json
    await pool.execute("\n        INSERT INTO async_jobs (id, user_id, type, status, payload)\n        VALUES ($1, $2, $3, 'pending', $4)\n        ", job_id, user_id, job_type, _json.dumps(payload))
    return job_id

async def get_job(job_id: str, user_id: str) -> dict | None:
    pool = await get_db_pool()
    row = await pool.fetchrow('SELECT * FROM async_jobs WHERE id = $1 AND user_id = $2', job_id, user_id)
    if row is None:
        return None
    return dict(row)

async def run_readme_job(job_id: str, user_id: str, github_token: str, repo_name: str):
    pool = await get_db_pool()
    await _update_job(pool, job_id, status='running')
    try:
        timeout = httpx.Timeout(60.0, connect=30.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            contents_resp = await client.get(f'https://api.github.com/repos/{repo_name}/contents', headers={'Authorization': f'token {github_token}', 'Accept': 'application/vnd.github.v3+json'})
            contents_resp.raise_for_status()
            contents = contents_resp.json()
        file_names = [item['name'] for item in contents]
        folder_names = [item['name'] for item in contents if item['type'] == 'dir']
        important_files: list[str] = []
        async with httpx.AsyncClient(timeout=timeout) as client:
            for file_name in ['package.json', 'requirements.txt', 'pyproject.toml', 'main.py', 'app.py', 'next.config.js', 'Dockerfile', 'docker-compose.yml', '.env.example']:
                try:
                    resp = await client.get(f'https://api.github.com/repos/{repo_name}/contents/{file_name}', headers={'Authorization': f'token {github_token}', 'Accept': 'application/vnd.github.v3.raw'})
                    if resp.status_code == 200:
                        important_files.append(f'\n===== {file_name} =====\n{resp.text[:1500]}')
                except Exception:
                    pass
        dir_snippets: list[str] = []
        async with httpx.AsyncClient(timeout=timeout) as client:
            for dir_name in ['src', 'app', 'backend', 'frontend', 'api']:
                try:
                    dir_resp = await client.get(f'https://api.github.com/repos/{repo_name}/contents/{dir_name}', headers={'Authorization': f'token {github_token}', 'Accept': 'application/vnd.github.v3+json'})
                    if dir_resp.status_code == 200:
                        dir_items = dir_resp.json()
                        for entry in dir_items:
                            if entry['type'] == 'file' and entry['name'].split('.')[-1] in ('py', 'ts', 'tsx', 'js', 'jsx'):
                                file_resp = await client.get(f'https://api.github.com/repos/{repo_name}/contents/{entry['path']}', headers={'Authorization': f'token {github_token}', 'Accept': 'application/vnd.github.v3.raw'})
                                if file_resp.status_code == 200:
                                    dir_snippets.append(f'\n===== {entry['path']} =====\n{file_resp.text[:1500]}')
                                break
                except Exception:
                    pass
        prompt = f'You are a senior software architect and technical documentation engineer.\nGenerate a production-grade GitHub README.md for the repository below.\n\nRepository: {repo_name}\nROOT FILES: {chr(10).join(file_names)}\nROOT FOLDERS: {chr(10).join(folder_names)}\nPROJECT FILES: {chr(10).join(important_files)}\nDIRECTORY SNIPPETS: {chr(10).join(dir_snippets)}\n\nCRITICAL:\nNever mention a technology unless it appears explicitly in the provided files.\nIf unsure, omit it.\nReturn EXACTLY ONE README.\nDo not repeat sections.\nDo not output multiple versions.\n\nGenerate a complete README with:\n1. Project title\n2. Overview\n3. Key features\n4. Technology stack\n5. Installation\n6. Usage\n7. Project structure\n8. API endpoints (if detected)\n9. Environment variables (if detected)\n10. License\nOutput raw markdown only.'
        async with httpx.AsyncClient(timeout=httpx.Timeout(900.0, connect=60.0)) as client:
            resp = await client.post(f'{settings.NEURAL_GENERATOR_URL}/generate', json={'prompt': prompt, 'max_tokens': 1200, 'temperature': 0.55, 'top_k': 50, 'top_p': 0.92})
            resp.raise_for_status()
            readme = resp.json().get('text', '').strip()
        for marker in ['Final Answer', "Alright, I've thoroughly analyzed"]:
            if marker in readme:
                readme = readme.split(marker, 1)[-1]
        readme = readme.replace('```markdown', '').replace('```', '').strip()
        if not readme:
            readme = f'# {repo_name.split('/')[-1]}\n\nREADME generation failed.\n'
        async with httpx.AsyncClient(timeout=timeout) as client:
            encoded_content = base64.b64encode(readme.encode()).decode()
            existing_resp = await client.get(f'https://api.github.com/repos/{repo_name}/contents/README.md', headers={'Authorization': f'token {github_token}', 'Accept': 'application/vnd.github.v3+json'})
            payload: dict[str, Any] = {'message': 'Add AI-generated README', 'content': encoded_content}
            if existing_resp.status_code == 200:
                payload['sha'] = existing_resp.json().get('sha')
            create_resp = await client.put(f'https://api.github.com/repos/{repo_name}/contents/README.md', headers={'Authorization': f'token {github_token}', 'Accept': 'application/vnd.github.v3+json'}, json=payload)
            if create_resp.status_code not in [200, 201]:
                raise RuntimeError(f'Failed to commit README: {create_resp.text}')
        import json as _json
        await _update_job(pool, job_id, status='done', result=_json.dumps({'readme': readme, 'repo': repo_name}))
    except Exception:
        tb = traceback.format_exc()
        print(f'[job_queue] README job {job_id} failed:\n{tb}')
        await _update_job(pool, job_id, status='failed', error=tb[-2000:])

async def run_resume_job(job_id: str, user_id: str, resume_type: str, job_description: str, skills: str, experience: str):
    pool = await get_db_pool()
    await _update_job(pool, job_id, status='running')
    try:
        from services.resume_ai_service import ResumeAIService
        from services.resume_template_service import ResumeTemplateService
        from services.resume_pdf_service import ResumePDFService
        ai_service = ResumeAIService()
        template_service = ResumeTemplateService()
        pdf_service = ResumePDFService()
        structured_data = await ai_service.generate_resume_data(resume_type, job_description, skills, experience)
        latex_resume = template_service.render_resume(structured_data)
        pdf_path = await pdf_service.compile_latex('generated_resume', latex_resume)
        with open(pdf_path, 'rb') as f:
            pdf_b64 = base64.b64encode(f.read()).decode()
        import json as _json
        await _update_job(pool, job_id, status='done', result=_json.dumps({'pdf_b64': pdf_b64}))
    except Exception:
        tb = traceback.format_exc()
        print(f'[job_queue] Resume job {job_id} failed:\n{tb}')
        await _update_job(pool, job_id, status='failed', error=tb[-2000:])

async def run_cover_letter_job(job_id: str, user_id: str, job_description: str, resume_text: str, company_name: str):
    pool = await get_db_pool()
    await _update_job(pool, job_id, status='running')
    try:
        from services.resume_ai_service import ResumeAIService
        ai_service = ResumeAIService()
        result = await ai_service.generate_cover_letter(job_description=job_description, resume_text=resume_text, company_name=company_name)
        import json as _json
        await _update_job(pool, job_id, status='done', result=_json.dumps(result))
    except Exception:
        tb = traceback.format_exc()
        print(f'[job_queue] Cover letter job {job_id} failed:\n{tb}')
        await _update_job(pool, job_id, status='failed', error=tb[-2000:])

async def run_linkedin_job(job_id: str, user_id: str, unlock_method: str, profile: dict):
    pool = await get_db_pool()
    await _update_job(pool, job_id, status='running')
    try:
        from services.linkedin_rules import run_rules
        from services.linkedin_ai_service import LinkedInAIService
        from services.linkedin_service import LinkedInService
        rule_report = run_rules(profile)
        ai_feedback = await LinkedInAIService().generate_feedback(profile, rule_report)
        analysis_id = await LinkedInService(pool).save_analysis(user_id, unlock_method, rule_report, ai_feedback)
        import json as _json
        await _update_job(pool, job_id, status='done', result=_json.dumps({'analysis_id': analysis_id, 'unlock_method': unlock_method, **rule_report, 'ai_feedback': ai_feedback}))
    except Exception:
        tb = traceback.format_exc()
        print(f'[job_queue] LinkedIn job {job_id} failed:\n{tb}')
        await _update_job(pool, job_id, status='failed', error=tb[-2000:])
