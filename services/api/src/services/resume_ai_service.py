import json
import sys
import re
import httpx
from pathlib import Path
from configs.config import settings

api_root = Path(__file__).resolve().parents[2]
sys.path.append(str(api_root))


class ResumeAIService:

    async def generate_resume_data(
        self,
        resume_type: str,
        job_description: str,
        skills: str,
        experience: str,
    ):

        prompt = (
            "You are a strict JSON generator. Return ONLY valid JSON.\n"
            "No markdown, no code fences, no explanations, no extra text.\n"
            "Do NOT output example JSON or placeholders like '...'.\n"
            "Output exactly one JSON object.\n\n"
            f"Resume Type: {resume_type}\n"
            f"Job Description: {job_description}\n"
            f"Skills: {skills}\n"
            f"Experience: {experience}\n\n"
            "Required JSON structure:\n"
            "{\n"
            '  "summary": "Brief professional summary",\n'
            '  "technical_skills": {\n'
            '    "languages": "Programming languages",\n'
            '    "backend": "Backend frameworks",\n'
            '    "ai_ml": "AI/ML technologies",\n'
            '    "databases": "Database technologies",\n'
            '    "tools": "Developer tools"\n'
            "  },\n"
            '  "experience": [\n'
            "    {\n"
            '      "company": "Company name",\n'
            '      "role": "Job title",\n'
            '      "duration": "Time period",\n'
            '      "location": "Location",\n'
            '      "bullets": ["Achievement 1", "Achievement 2", "Achievement 3"]\n'
            "    }\n"
            "  ],\n"
            '  "projects": [\n'
            "    {\n"
            '      "title": "Project name",\n'
            '      "tech": "Technologies used",\n'
            '      "github": "GitHub URL or none",\n'
            '      "bullets": ["Feature 1", "Feature 2", "Feature 3"]\n'
            "    }\n"
            "  ]\n"
            "}"
        )

        async with httpx.AsyncClient(timeout=600) as client:
            response = await client.post(
                f"{settings.NEURAL_GENERATOR_URL}/generate",
                json={
                    "prompt": prompt,
                    "max_tokens": 800,
                    "temperature": 0.0,
                    "top_k": 1,
                    "top_p": 0.1,
                }
            )
            response.raise_for_status()
            output = response.json()

        text = output.get("text", "").strip()
        text = text.replace("```json", "").replace("```", "").strip()

        print("\nRAW MODEL OUTPUT:\n")
        print(text)
        print("\nEND RAW OUTPUT\n")

        json_text = self._extract_first_json(text)

        if not json_text:
            raise Exception(f"No valid JSON found in model output\n\nRAW MODEL OUTPUT:\n{text}")

        print("\nEXTRACTED JSON:\n")
        print(json_text)
        print("\nEND JSON\n")

        try:
            parsed_json = json.loads(json_text)
            self._validate_and_repair_json(parsed_json)
            return parsed_json
        except Exception as exc:
            print("\nFAILED JSON:\n")
            print(json_text)
            raise Exception(f"JSON parsing failed: {str(exc)}")

    def _extract_first_json(self, text: str):
        start = text.find('{')
        if start == -1:
            return None

        decoder = json.JSONDecoder()
        try:
            obj, end = decoder.raw_decode(text[start:])
            return text[start:start+end]
        except json.JSONDecodeError:
            pass

        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if escape:
                escape = False
                continue
            if ch == '\\':
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if not in_string:
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        candidate = text[start:i+1]
                        repaired = self._repair_json(candidate)
                        try:
                            json.loads(repaired)
                            return repaired
                        except json.JSONDecodeError:
                            continue
        return None

    def _repair_json(self, text: str) -> str:
        text = re.sub(r'([\{\s,])([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', text)
        text = re.sub(r',\s*}', '}', text)
        text = re.sub(r',\s*]', ']', text)
        text = re.sub(r':\s*([^"{\[][^,}\]]*?)(,|})', r': "\1"\2', text)
        text = re.sub(r'"\s+', '" ', text)
        text = re.sub(r'\s+"', ' "', text)
        text = re.sub(r'}\s*}\s*]', '}]', text)
        text = re.sub(r'}\s*}\s*}', '}}', text)
        return text

    def _validate_and_repair_json(self, data):
        if "summary" not in data:
            raise Exception("Missing required key: summary")
        if "technical_skills" not in data:
            raise Exception("Missing required key: technical_skills")
        if "experience" not in data:
            data["experience"] = []
        if "projects" not in data:
            data["projects"] = []

        tech_skills = data.get("technical_skills", {})
        required_tech = ["languages", "backend", "ai_ml", "databases", "tools"]
        for key in required_tech:
            if key not in tech_skills:
                tech_skills[key] = ""
            if isinstance(tech_skills[key], list):
                tech_skills[key] = ", ".join(tech_skills[key])

        if not isinstance(data["experience"], list):
            data["experience"] = []
        for idx, exp in enumerate(data["experience"]):
            if not isinstance(exp, dict):
                data["experience"][idx] = exp = {}
            exp.setdefault("company", "")
            exp.setdefault("role", "")
            exp.setdefault("duration", "")
            exp.setdefault("location", "")
            exp.setdefault("bullets", [])

        if not isinstance(data["projects"], list):
            data["projects"] = []
        for idx, proj in enumerate(data["projects"]):
            if not isinstance(proj, dict):
                data["projects"][idx] = proj = {}
            proj.setdefault("title", "")
            proj.setdefault("tech", "")
            proj.setdefault("github", "")
            proj.setdefault("bullets", [])

        self._split_misplaced_items(data)

    def _split_misplaced_items(self, data):
        fixed_experience = []
        for exp in data["experience"]:
            if "company" in exp and exp["company"]:
                fixed_experience.append(exp)
            elif "title" in exp and exp["title"]:
                proj = {
                    "title": exp.get("title", ""),
                    "tech": exp.get("tech", ""),
                    "github": exp.get("github", ""),
                    "bullets": exp.get("bullets", [])
                }
                data["projects"].append(proj)
            else:
                fixed_experience.append(exp)
        data["experience"] = fixed_experience