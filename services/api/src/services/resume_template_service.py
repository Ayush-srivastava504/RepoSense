from pathlib import Path
import re
from jinja2 import Environment, FileSystemLoader, select_autoescape


class ResumeTemplateService:

    # Special characters that must be escaped in LaTeX text mode.
    # NOTE: applied in a single regex pass (see latex_escape below), not via
    # sequential str.replace() calls. Sequential replacement is unsafe here:
    # once "\" becomes "\textbackslash{}", a later replacement for "{" would
    # re-match the "{" inside the text we just introduced and corrupt it into
    # "\textbackslash\{}". A single pass over the *original* string guarantees
    # each source character is substituted exactly once.
    _LATEX_REPLACEMENTS = {
        "\\": r"\textbackslash{}",
        "&":  r"\&",
        "%":  r"\%",
        "$":  r"\$",
        "#":  r"\#",
        "_":  r"\_",
        "{":  r"\{",
        "}":  r"\}",
        "~":  r"\textasciitilde{}",
        "^":  r"\textasciicircum{}",
    }
    _LATEX_PATTERN = re.compile(
        "|".join(re.escape(c) for c in _LATEX_REPLACEMENTS)
    )

    def latex_escape(self, text: str) -> str:
        """Escape a plain-text string for safe inclusion in LaTeX."""
        if not text:
            return ""
        text = str(text)
        return self._LATEX_PATTERN.sub(
            lambda m: self._LATEX_REPLACEMENTS[m.group(0)], text
        )

    def _make_env(self, template_dir: Path) -> Environment:
        """
        Build a Jinja2 Environment whose delimiters don't clash with LaTeX.

        Delimiters match what the template uses:
          variables : \\VAR{ ... }
          blocks    : \\BLOCK{ ... }
          comments  : \\#{ ... }
        """
        env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            block_start_string=r"\BLOCK{",
            block_end_string="}",
            variable_start_string=r"\VAR{",
            variable_end_string="}",
            comment_start_string=r"\#{",
            comment_end_string="}",
            trim_blocks=True,
            lstrip_blocks=True,
            # autoescape=False because this is LaTeX, not HTML
            autoescape=False,
        )
        # Register our escaper as a template filter: \VAR{value | latex}
        env.filters["latex"] = self.latex_escape
        return env

    def render_resume(self, data: dict) -> str:
        """
        Render resume_template.tex with *data* and return the filled LaTeX source.

        Expected top-level keys in *data*:
          name, email, phone, github_url, github_display,
          website_url, website_display, summary,
          technical_skills (dict), experience (list), education (list),
          projects (list), achievements (list), certifications (list)
        """
        # Resolve template directory regardless of where this file lives.
        # File is at  <root>/src/services/resume_template_service.py
        # Template is at <root>/templates/resume_template.tex
        template_dir = (
            Path(__file__).resolve().parent.parent.parent / "templates"
        )

        env = self._make_env(template_dir)
        template = env.get_template("resume_template.tex")

        # Normalise list-valued skill fields to comma-joined strings
        # so the template receives plain strings everywhere.
        technical = dict(data.get("technical_skills") or {})
        for key in ("languages", "backend", "ai_ml", "databases", "tools"):
            val = technical.get(key, "")
            if isinstance(val, list):
                technical[key] = ", ".join(str(v) for v in val)

        context = dict(data)
        context["technical_skills"] = technical or None   # falsy → \BLOCK{if} skips section

        return template.render(context)