from pathlib import Path
import os


class ResumeTemplateService:

    def latex_escape(
        self,
        text: str
    ) -> str:

        if not text:
            return ""

        text = str(text)

        replacements = {
            "&": r"\&",
            "%": r"\%",
            "$": r"\$",
            "#": r"\#",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "~": r"\textasciitilde{}",
            "^": r"\textasciicircum{}",
        }

        for old, new in replacements.items():
            text = text.replace(old, new)

        return text

    def render_resume(
        self,
        data: dict,
    ):

        template_path = (
            Path(
                os.path.abspath(__file__)
            ).parent.parent.parent.parent
            / "templates"
            / "resume_template.tex"
        )

        with open(
            template_path,
            "r",
            encoding="utf-8"
        ) as f:

            template = f.read()

        technical = data.get(
            "technical_skills",
            {}
        )

        def format_skill(value):

            if isinstance(value, list):

                value = ", ".join(
                    str(v)
                    for v in value
                )

            return self.latex_escape(
                str(value)
            ) if value else ""

        template = template.replace(
            "{{SUMMARY}}",
            self.latex_escape(
                data.get(
                    "summary",
                    ""
                )
            )
        )

        template = template.replace(
            "{{TECH_LANGUAGES}}",
            format_skill(
                technical.get(
                    "languages",
                    ""
                )
            )
        )

        template = template.replace(
            "{{TECH_BACKEND}}",
            format_skill(
                technical.get(
                    "backend",
                    ""
                )
            )
        )

        template = template.replace(
            "{{TECH_AI}}",
            format_skill(
                technical.get(
                    "ai_ml",
                    ""
                )
            )
        )

        template = template.replace(
            "{{TECH_DATABASES}}",
            format_skill(
                technical.get(
                    "databases",
                    ""
                )
            )
        )

        template = template.replace(
            "{{TECH_TOOLS}}",
            format_skill(
                technical.get(
                    "tools",
                    ""
                )
            )
        )

        experience_section = ""

        for exp in data.get(
            "experience",
            []
        ):

            bullets = ""

            for bullet in exp.get(
                "bullets",
                []
            ):

                bullets += (
                    f"\\resumeItem{{{self.latex_escape(bullet)}}}\n"
                )

            bullets_section = ""

            if bullets.strip():

                bullets_section = (
                    f"\n\\resumeItemListStart\n"
                    f"{bullets}"
                    f"\\resumeItemListEnd"
                )

            company = self.latex_escape(
                exp.get(
                    "company",
                    ""
                )
            )

            location = self.latex_escape(
                exp.get(
                    "location",
                    ""
                )
            )

            role = self.latex_escape(
                exp.get(
                    "role",
                    ""
                )
            )

            duration = self.latex_escape(
                exp.get(
                    "duration",
                    ""
                )
            )

            experience_section += (
                f"\\resumeSubheading"
                f"{{{company}}}"
                f"{{{location}}}"
                f"{{{role}}}"
                f"{{{duration}}}"
                f"{bullets_section}\n"
            )

        project_section = ""

        for proj in data.get(
            "projects",
            []
        ):

            bullets = ""

            for bullet in proj.get(
                "bullets",
                []
            ):

                bullets += (
                    f"\\resumeItem{{{self.latex_escape(bullet)}}}\n"
                )

            bullets_section = ""

            if bullets.strip():

                bullets_section = (
                    f"\n\\resumeItemListStart\n"
                    f"{bullets}"
                    f"\\resumeItemListEnd"
                )

            title = self.latex_escape(
                proj.get(
                    "title",
                    ""
                )
            )

            tech = self.latex_escape(
                proj.get(
                    "tech",
                    ""
                )
            )

            github_link = proj.get(
                "github",
                ""
            )

            heading = (
                f"\\textbf{{{title}}} "
                f"$\\mid$ "
                f"\\emph{{{tech}}}"
            )

            if github_link:

                github_tex = (
                    f"\\href{{{github_link}}}{{GitHub}}"
                )

                project_section += (
                    f"\\resumeProjectHeading"
                    f"{{{heading}}}"
                    f"{{{github_tex}}}"
                    f"{bullets_section}\n"
                )

            else:

                project_section += (
                    f"\\resumeProjectHeading"
                    f"{{{heading}}}"
                    f"{{}}"
                    f"{bullets_section}\n"
                )

        experience_content = (
            experience_section.strip()
        )

        if not experience_content:

            experience_section_replacement = (
                "\\noindent\\textit"
                "{No experience data provided.}"
            )

        else:

            experience_section_replacement = (
                "\\begin{itemize}[leftmargin=0pt]\n"
                f"{experience_section}"
                "\\end{itemize}"
            )

        project_content = (
            project_section.strip()
        )

        if not project_content:

            project_section_replacement = (
                "\\noindent\\textit"
                "{No projects data provided.}"
            )

        else:

            project_section_replacement = (
                "\\begin{itemize}[leftmargin=0pt]\n"
                f"{project_section}"
                "\\end{itemize}"
            )

        template = template.replace(
            "{{EXPERIENCE_SECTION}}",
            experience_section_replacement
        )

        template = template.replace(
            "{{PROJECT_SECTION}}",
            project_section_replacement
        )

        return template