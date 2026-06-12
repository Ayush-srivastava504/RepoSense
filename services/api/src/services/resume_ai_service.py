import json
import sys
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

        prompt = f"""
You are a JSON API.

Return ONLY ONE valid JSON object.

Rules:
- No markdown
- No code fences
- No explanations
- No Example section
- No Answer section
- No repeated JSON
- Output must start with {{
- Output must end with }}

Resume Type:
{resume_type}

Job Description:
{job_description}

Skills:
{skills}

Experience:
{experience}

Required fields:

summary

technical_skills:
- languages
- backend
- ai_ml
- databases
- tools

experience:
- company
- role
- duration
- location
- bullets

projects:
- title
- tech
- github
- bullets
"""

        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(
                f"{settings.NEURAL_GENERATOR_URL}/generate",
                json={
                    "prompt": prompt,
                    "max_tokens": 400,
                    "temperature": 0.0,
                    "top_k": 1,
                    "top_p": 0.1,
                }
            )

            response.raise_for_status()
            output = response.json()

        text = output.get("text", "").strip()

        # Remove markdown code fences and stray backticks
        text = (
            text.replace("```json", "")
            .replace("```", "")
            .replace("`", "")
            .strip()
        )

        # If the model includes an "Example" and then "Answer:", discard everything before "Answer:"
        if "Answer:" in text:
            text = text.split("Answer:", 1)[1].strip()
        # Also handle "Now, generate a valid JSON" variations
        if "Now, generate a valid JSON" in text:
            text = text.split("Now, generate a valid JSON", 1)[-1].strip()

        print("\nRAW MODEL OUTPUT (after cleaning):\n")
        print(text)
        print("\nEND RAW OUTPUT\n")

        json_text = self._extract_first_json(text)

        if not json_text:
            raise Exception(f"No valid JSON found in model output\n\nRAW MODEL OUTPUT:\n{text}")

        print("\nEXTRACTED JSON:\n")
        print(json_text)
        print("\nEND JSON\n")

        parsed_json = json.loads(json_text)
        self._validate_and_repair_json(parsed_json)

        return parsed_json

    def _extract_first_json(self, text: str):
        """
        Extract the first valid JSON object from the given text.
        Uses the standard json.JSONDecoder to find a complete JSON object.
        """
        decoder = json.JSONDecoder()
        # Find the first '{' position
        start = text.find("{")
        if start == -1:
            return None

        # Try to decode from that position
        try:
            obj, end = decoder.raw_decode(text[start:])
            # Return the exact JSON substring
            return text[start:start + end]
        except json.JSONDecodeError:
            # If the first '{' didn't yield valid JSON, scan further
            for i in range(start + 1, len(text)):
                if text[i] == "{":
                    try:
                        obj, end = decoder.raw_decode(text[i:])
                        return text[i:i + end]
                    except json.JSONDecodeError:
                        continue
            return None

    def _validate_and_repair_json(self, data):
        """Ensure all required fields exist and have correct types (no syntax repair)."""
        if "summary" not in data:
            raise Exception("Missing required key: summary")

        # Handle technical_skills: it could be a dict or a list containing one dict
        tech_skills = data.get("technical_skills")
        if tech_skills is None:
            raise Exception("Missing required key: technical_skills")
        
        # Convert list of one dict -> dict
        if isinstance(tech_skills, list) and len(tech_skills) == 1 and isinstance(tech_skills[0], dict):
            tech_skills = tech_skills[0]
            data["technical_skills"] = tech_skills
        elif not isinstance(tech_skills, dict):
            # If it's some other type, replace with empty dict
            tech_skills = {}
            data["technical_skills"] = tech_skills

        required_tech = ["languages", "backend", "ai_ml", "databases", "tools"]
        for key in required_tech:
            if key not in tech_skills:
                tech_skills[key] = ""
            if isinstance(tech_skills[key], list):
                tech_skills[key] = ", ".join(tech_skills[key])

        # Ensure experience and projects exist and are lists
        if "experience" not in data:
            data["experience"] = []
        if "projects" not in data:
            data["projects"] = []

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
            # If tech is a list, convert to comma-separated string
            if isinstance(proj.get("tech"), list):
                proj["tech"] = ", ".join(proj["tech"])

        # Optional: remove any extra "skills" field that might confuse downstream
        if "skills" in data:
            del data["skills"]

        self._split_misplaced_items(data)

    def _split_misplaced_items(self, data):
        """Move items that look like projects out of the experience list."""
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