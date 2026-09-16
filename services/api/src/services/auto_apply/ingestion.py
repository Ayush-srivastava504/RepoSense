import re
import json
import logging
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class ExperienceEntry(BaseModel):
    company: str
    role: str
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    location: Optional[str] = ""
    description: Optional[str] = ""
    bullets: List[str] = Field(default_factory=list)

class EducationEntry(BaseModel):
    institution: str
    degree: str
    field_of_study: Optional[str] = ""
    start_year: Optional[str] = ""
    end_year: Optional[str] = ""
    gpa: Optional[str] = ""

class CandidateProfile(BaseModel):
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    linkedin_url: Optional[str] = ""
    github_url: Optional[str] = ""
    website_url: Optional[str] = ""
    skills: List[str] = Field(default_factory=list)
    work_experience: List[ExperienceEntry] = Field(default_factory=list)
    education: List[EducationEntry] = Field(default_factory=list)
    summary: Optional[str] = ""
    raw_text: Optional[str] = ""
    resume_file_path: Optional[str] = ""

COMMON_SKILLS_TAXONOMY = [
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "FastAPI",
    "Django", "Flask", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Docker", "Kubernetes",
    "AWS", "GCP", "Azure", "Git", "GitHub", "CI/CD", "REST API", "GraphQL", "PyTorch",
    "TensorFlow", "scikit-learn", "HTML", "CSS", "Tailwind CSS", "C++", "Java", "Go",
    "Rust", "SQL", "Linux", "Bash", "Selenium", "Playwright", "Unit Testing", "System Design"
]

class ProfileIngestionEngine:
    """Layer 1: Profile & Resume Ingestion Engine."""

    def __init__(self):
        pass

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract plain text from PDF byte content using pdfminer or fallback."""
        try:
            from pdfminer.high_level import extract_text
            import io
            return extract_text(io.BytesIO(pdf_bytes))
        except Exception as e:
            logger.warning(f"pdfminer text extraction failed: {e}. Using fallback decoder.")
            try:
                # Basic string extraction fallback
                text = pdf_bytes.decode('utf-8', errors='ignore')
                clean_lines = [line for line in text.splitlines() if any(c.isalnum() for c in line)]
                return "\n".join(clean_lines)
            except Exception as inner_e:
                logger.error(f"Fallback extraction failed: {inner_e}")
                return ""

    def parse_pdf_resume(self, pdf_bytes: bytes, file_name: str = "resume.pdf") -> CandidateProfile:
        """Parse PDF resume bytes into structured CandidateProfile."""
        text = self.extract_text_from_pdf(pdf_bytes)
        profile = self.parse_text_to_profile(text)
        profile.raw_text = text
        profile.resume_file_path = file_name
        return profile

    def parse_text_to_profile(self, text: str) -> CandidateProfile:
        """Extract structured fields from raw resume text."""
        profile = CandidateProfile(raw_text=text)

        # 1. Contact Info Extraction
        email_match = re.search(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
        if email_match:
            profile.email = email_match.group(0)

        phone_match = re.search(r'\(?\+?[0-9]{1,4}\)?[-. ]?\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}', text)
        if phone_match:
            profile.phone = phone_match.group(0)

        linkedin_match = re.search(r'https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+', text)
        if linkedin_match:
            profile.linkedin_url = linkedin_match.group(0)

        github_match = re.search(r'https?://(?:www\.)?github\.com/[a-zA-Z0-9_-]+', text)
        if github_match:
            profile.github_url = github_match.group(0)

        # 2. Extract Full Name (First few lines heuristic)
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for line in lines[:5]:
            if not any(keyword in line.lower() for keyword in ['resume', 'curriculum', 'email', 'phone', 'http', '@', 'page']):
                if len(line.split()) <= 4 and re.match(r'^[A-Za-z\s.-]+$', line):
                    profile.full_name = line
                    break

        # 3. Extract Skills via taxonomy matching
        extracted_skills = set()
        for skill in COMMON_SKILLS_TAXONOMY:
            pattern = r'\b' + re.escape(skill) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                extracted_skills.add(skill)
        profile.skills = sorted(list(extracted_skills))

        # 4. Basic Experience & Education Parsing Heuristics
        exp_entries = []
        edu_entries = []

        in_exp_section = False
        in_edu_section = False

        current_exp_bullets = []
        current_exp_title = ""

        for line in lines:
            line_lower = line.lower()

            if any(h in line_lower for h in ['experience', 'work history', 'employment']):
                in_exp_section = True
                in_edu_section = False
                continue
            elif any(h in line_lower for h in ['education', 'academic background', 'degrees']):
                in_edu_section = True
                in_exp_section = False
                continue
            elif any(h in line_lower for h in ['projects', 'skills', 'certifications']):
                in_exp_section = False
                in_edu_section = False

            if in_exp_section:
                if line.startswith(('•', '-', '*')) or len(line.split()) > 5:
                    current_exp_bullets.append(line.lstrip('•-* '))
                elif line:
                    if current_exp_title and current_exp_bullets:
                        exp_entries.append(ExperienceEntry(
                            company="Company",
                            role=current_exp_title,
                            bullets=current_exp_bullets[:5]
                        ))
                        current_exp_bullets = []
                    current_exp_title = line

            if in_edu_section:
                if any(deg in line_lower for deg in ['bachelor', 'master', 'bs', 'ms', 'b.tech', 'm.tech', 'phd', 'degree']):
                    edu_entries.append(EducationEntry(
                        institution="University / Institute",
                        degree=line
                    ))

        if current_exp_title and current_exp_bullets:
            exp_entries.append(ExperienceEntry(
                company="Company",
                role=current_exp_title,
                bullets=current_exp_bullets[:5]
            ))

        profile.work_experience = exp_entries
        profile.education = edu_entries

        return profile

    def parse_linkedin_json(self, linkedin_data: Dict[str, Any]) -> CandidateProfile:
        """Parse structured LinkedIn Export JSON data into CandidateProfile."""
        profile = CandidateProfile()

        # Handle Profile.json / Positions.json format
        if 'firstName' in linkedin_data or 'lastName' in linkedin_data:
            first = linkedin_data.get('firstName', '')
            last = linkedin_data.get('lastName', '')
            profile.full_name = f"{first} {last}".strip()

        if 'emailAddress' in linkedin_data:
            profile.email = linkedin_data.get('emailAddress', '')

        if 'headline' in linkedin_data:
            profile.summary = linkedin_data.get('headline', '')

        # Positions
        positions = linkedin_data.get('positions', [])
        for pos in positions:
            profile.work_experience.append(ExperienceEntry(
                company=pos.get('companyName', ''),
                role=pos.get('title', ''),
                start_date=pos.get('startDate', ''),
                end_date=pos.get('endDate', 'Present'),
                location=pos.get('location', ''),
                description=pos.get('description', '')
            ))

        # Skills
        skills_data = linkedin_data.get('skills', [])
        for s in skills_data:
            name = s.get('name') if isinstance(s, dict) else str(s)
            if name and name not in profile.skills:
                profile.skills.append(name)

        return profile
