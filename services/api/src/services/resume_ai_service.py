# Module: src/services/resume_ai_service.py
# Defines class(es): ResumeAIService
#
#

import json
import httpx
from configs.config import settings

class ResumeAIService:

    async def generate_resume_data(self, resume_type: str, job_description: str, skills: str, experience: str):
        prompt = f'You are a JSON generator. Output only a single valid JSON object. No markdown, no explanation, no code fences, no text before or after.\n\nThe JSON must follow this exact structure:\n{{\n  "summary": "2-3 sentence professional summary",\n  "technical_skills": {{\n    "languages": "comma separated list",\n    "backend": "comma separated list",\n    "ai_ml": "comma separated list",\n    "databases": "comma separated list",\n    "tools": "comma separated list"\n  }},\n  "experience": [\n    {{\n      "company": "company name",\n      "role": "job title",\n      "duration": "start - end",\n      "location": "city, country",\n      "bullets": ["achievement 1", "achievement 2"]\n    }}\n  ],\n  "projects": [\n    {{\n      "title": "project name",\n      "tech": "comma separated tech stack",\n      "github": "url or empty string",\n      "bullets": ["what it does", "impact"]\n    }}\n  ]\n}}\n\nResume type: {resume_type}\nJob description: {job_description}\nSkills: {skills}\nExperience: {experience}\n\nOutput the JSON now:'
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(f'{settings.NEURAL_GENERATOR_URL}/generate', json={'prompt': prompt, 'max_tokens': 800, 'temperature': 0.1, 'top_k': 1, 'top_p': 0.1, 'repeat_penalty': 1.1})
            response.raise_for_status()
            output = response.json()
        text = output.get('text', '').strip()
        text = text.replace('```json', '').replace('```', '').replace('`', '').strip()
        json_text = self._extract_first_json(text)
        if not json_text:
            raise Exception(f'No valid JSON in model output:\n{text}')
        parsed_json = json.loads(json_text)
        self._normalize(parsed_json)
        return parsed_json

    async def generate_cover_letter(self, job_description: str, resume_text: str, company_name: str=''):
        prompt = f'You are a career writing assistant. Write a short, specific cover letter (250-350 words) for this application. No markdown, no placeholders like [Company Name] left unfilled if the company name is given below, no generic filler sentences. Reference 1-2 concrete things from the resume that match the job description. Output only the letter body text, no subject line, no explanation.\n\nCompany: {company_name or 'the company'}\nJob description: {job_description}\nCandidate resume: {resume_text}\n\nCover letter:'
        async with httpx.AsyncClient(timeout=300) as client:
            response = await client.post(f'{settings.NEURAL_GENERATOR_URL}/generate', json={'prompt': prompt, 'max_tokens': 500, 'temperature': 0.4, 'top_k': 40, 'top_p': 0.9, 'repeat_penalty': 1.1})
            response.raise_for_status()
            output = response.json()
        text = output.get('text', '').strip()
        text = text.replace('```', '').strip()
        return {'letter': text}

    def _extract_first_json(self, text: str):
        decoder = json.JSONDecoder()
        start = text.find('{')
        if start == -1:
            return None
        try:
            obj, end = decoder.raw_decode(text[start:])
            return text[start:start + end]
        except json.JSONDecodeError:
            for i in range(start + 1, len(text)):
                if text[i] == '{':
                    try:
                        obj, end = decoder.raw_decode(text[i:])
                        return text[i:i + end]
                    except json.JSONDecodeError:
                        continue
        return None

    def _normalize(self, data: dict):
        if 'summary' not in data or not data['summary']:
            data['summary'] = ''
        tech = data.get('technical_skills')
        if isinstance(tech, list):
            merged = {}
            for item in tech:
                if isinstance(item, dict):
                    merged.update(item)
            tech = merged
            data['technical_skills'] = tech
        if not isinstance(tech, dict):
            tech = {}
            data['technical_skills'] = tech
        for key in ['languages', 'backend', 'ai_ml', 'databases', 'tools']:
            val = tech.get(key, '')
            if isinstance(val, list):
                tech[key] = ', '.join((str(v) for v in val))
            elif not isinstance(val, str):
                tech[key] = str(val) if val else ''
            else:
                tech[key] = val
        if not isinstance(data.get('experience'), list):
            data['experience'] = []
        clean_exp = []
        for item in data['experience']:
            if not isinstance(item, dict):
                continue
            if not item.get('company') and item.get('title'):
                data.setdefault('projects', []).append({'title': item.get('title', ''), 'tech': item.get('tech', ''), 'github': item.get('github', ''), 'bullets': item.get('bullets', [])})
                continue
            item.setdefault('company', '')
            item.setdefault('role', '')
            item.setdefault('duration', '')
            item.setdefault('location', '')
            bullets = item.get('bullets', [])
            item['bullets'] = bullets if isinstance(bullets, list) else [bullets]
            clean_exp.append(item)
        data['experience'] = clean_exp
        if not isinstance(data.get('projects'), list):
            data['projects'] = []
        for proj in data['projects']:
            if not isinstance(proj, dict):
                continue
            proj.setdefault('title', '')
            proj.setdefault('tech', '')
            proj.setdefault('github', '')
            bullets = proj.get('bullets', [])
            proj['bullets'] = bullets if isinstance(bullets, list) else [bullets]
            if isinstance(proj.get('tech'), list):
                proj['tech'] = ', '.join(proj['tech'])
        for bad_key in ['skills', 'answer', 'example', 'output']:
            data.pop(bad_key, None)
