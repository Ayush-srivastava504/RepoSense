import json
import sys
import re
import httpx

from pathlib import Path

from configs.config import settings


api_root = Path(
    __file__
).resolve().parents[2]

sys.path.append(
    str(api_root)
)


class ResumeAIService:

    async def generate_resume_data(
        self,
        resume_type: str,
        job_description: str,
        skills: str,
        experience: str,
    ):

        prompt = (
            f"You are a strict JSON generator.\n"
            f"Return ONLY valid JSON.\n"
            f"Do not explain.\n"
            f"Do not think aloud.\n"
            f"Do not include reasoning.\n"
            f"Do not include markdown.\n"
            f"Do not include code fences.\n"
            f"Do not include notes.\n"
            f"Your FIRST character must be {{\n"
            f"Your LAST character must be }}\n\n"

            f"Resume Type: {resume_type}\n"
            f"Job Description: {job_description}\n"
            f"Skills: {skills}\n"
            f"Experience: {experience}\n\n"

            "CRITICAL RULES:\n"
            "1. Return ONLY ONE valid JSON object\n"
            "2. EVERY property name MUST use double quotes\n"
            "3. EVERY string value MUST use double quotes\n"
            "4. No markdown\n"
            "5. No explanations\n"
            "6. No comments\n"
            "7. No repeated JSON\n"
            "8. No chain of thought\n\n"

            "REQUIRED JSON STRUCTURE:\n"

            "{\n"
            '  "summary": "Brief professional summary",\n'

            '  "technical_skills": {\n'
            '    "languages": "Programming languages",\n'
            '    "backend": "Backend frameworks",\n'
            '    "ai_ml": "AI and ML technologies",\n'
            '    "databases": "Database technologies",\n'
            '    "tools": "Developer tools and platforms"\n'
            "  },\n"

            '  "experience": [\n'
            "    {\n"
            '      "company": "Company name",\n'
            '      "role": "Job title",\n'
            '      "duration": "Time period",\n'
            '      "location": "Location",\n'
            '      "bullets": [\n'
            '        "Achievement 1",\n'
            '        "Achievement 2",\n'
            '        "Achievement 3"\n'
            "      ]\n"
            "    }\n"
            "  ],\n"

            '  "projects": [\n'
            "    {\n"
            '      "title": "Project name",\n'
            '      "tech": "Technologies used",\n'
            '      "github": "GitHub URL or none",\n'
            '      "bullets": [\n'
            '        "Feature or achievement 1",\n'
            '        "Feature or achievement 2",\n'
            '        "Feature or achievement 3"\n'
            "      ]\n"
            "    }\n"
            "  ]\n"

            "}\n"
        )

        async with httpx.AsyncClient(timeout=120) as client:

            response = await client.post(
                f"{settings.NEURAL_GENERATOR_URL}/generate",
                json={
                    "prompt": prompt,
                    "max_tokens": 1000,
                    "temperature": 0,
                    "top_k": 1,
                    "top_p": 0.1,
                }
            )

            response.raise_for_status()

            output = response.json()

        text = output.get(
            "text",
            ""
        ).strip()

        text = (
            text
            .replace("```json", "")
            .replace("```", "")
            .strip()
        )

        print("\nRAW MODEL OUTPUT:\n")
        print(text)
        print("\nEND RAW OUTPUT\n")

        json_text = self._extract_json(text)

        if not json_text:

            raise Exception(
                f"No JSON found in model output\n\nRAW MODEL OUTPUT:\n{text}"
            )

        json_text = self._repair_json(json_text)

        print("\nEXTRACTED JSON:\n")
        print(json_text)
        print("\nEND JSON\n")

        if not json_text.strip().endswith("}"):

            raise Exception(
                "Model output truncated before JSON completion"
            )

        try:

            parsed_json = json.loads(
                json_text
            )

            self._validate_resume_json(
                parsed_json
            )

            return parsed_json

        except Exception as exc:

            print("\nFAILED JSON:\n")
            print(json_text)

            raise Exception(
                f"JSON parsing failed: {str(exc)}"
            )

    def _extract_json(
        self,
        text: str
    ):

        start = text.find("{")

        if start == -1:
            return None

        stack = 0
        in_string = False
        escape_next = False

        for i in range(start, len(text)):

            char = text[i]

            if escape_next:
                escape_next = False
                continue

            if char == "\\":
                escape_next = True
                continue

            if char == '"':
                in_string = not in_string
                continue

            if not in_string:

                if char == "{":
                    stack += 1

                elif char == "}":
                    stack -= 1

                    if stack == 0:
                        return text[start:i + 1]

        return None

    def _validate_resume_json(
        self,
        data: dict
    ):

        required_top = [
            "summary",
            "technical_skills",
            "experience",
            "projects"
        ]

        for key in required_top:

            if key not in data:

                raise Exception(
                    f"Missing required top-level key: {key}"
                )

        tech_skills = data.get(
            "technical_skills",
            {}
        )

        required_tech = [
            "languages",
            "backend",
            "ai_ml",
            "databases",
            "tools"
        ]

        for key in required_tech:

            if key not in tech_skills:

                raise Exception(
                    f"Missing technical_skills key: {key}"
                )

        if not isinstance(
            data.get("experience"),
            list
        ):

            raise Exception(
                "'experience' must be a list"
            )

        for idx, exp in enumerate(
            data["experience"]
        ):

            if not isinstance(exp, dict):

                raise Exception(
                    f"Experience entry {idx} is not an object"
                )

            for sub_key in [
                "company",
                "role",
                "duration",
                "location",
                "bullets"
            ]:

                if sub_key not in exp:

                    raise Exception(
                        f"Missing experience[{idx}] key: {sub_key}"
                    )

            if not isinstance(
                exp["bullets"],
                list
            ):

                raise Exception(
                    f"Experience[{idx}].bullets must be a list"
                )

        if not isinstance(
            data.get("projects"),
            list
        ):

            raise Exception(
                "'projects' must be a list"
            )

        for idx, proj in enumerate(
            data["projects"]
        ):

            if not isinstance(
                proj,
                dict
            ):

                raise Exception(
                    f"Project entry {idx} is not an object"
                )

            for sub_key in [
                "title",
                "tech",
                "github",
                "bullets"
            ]:

                if sub_key not in proj:

                    raise Exception(
                        f"Missing projects[{idx}] key: {sub_key}"
                    )

            if not isinstance(
                proj["bullets"],
                list
            ):

                raise Exception(
                    f"Projects[{idx}].bullets must be a list"
                )

    def _repair_json(
        self,
        text
    ):

        text = re.sub(
            r'([,\{\s])([a-zA-Z_][a-zA-Z0-9_]*)\s*:',
            r'\1"\2":',
            text
        )

        text = re.sub(
            r'^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:',
            r'\1"\2":',
            text,
            flags=re.MULTILINE
        )

        lines = text.splitlines()

        for i in range(len(lines) - 1):

            stripped = lines[i].strip()

            if (
                stripped
                and not stripped.endswith((',', '{', '['))
            ):

                next_stripped = lines[i + 1].lstrip()

                if next_stripped.startswith('"'):

                    lines[i] = lines[i] + ','

        text = "\n".join(lines)

        text = re.sub(
            r":\s*'([^']*)'",
            r': "\1"',
            text
        )

        text = re.sub(
            r',(\s*[}\]])',
            r'\1',
            text
        )

        return text