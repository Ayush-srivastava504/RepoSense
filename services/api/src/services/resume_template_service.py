# Module: src/services/resume_template_service.py
# Defines class(es): ResumeTemplateService
#
#

from pathlib import Path
import re
from jinja2 import Environment, FileSystemLoader, select_autoescape

class ResumeTemplateService:
    _LATEX_REPLACEMENTS = {'\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', '$': '\\$', '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}'}
    _LATEX_PATTERN = re.compile('|'.join((re.escape(c) for c in _LATEX_REPLACEMENTS)))

    def latex_escape(self, text: str) -> str:
        if not text:
            return ''
        text = str(text)
        return self._LATEX_PATTERN.sub(lambda m: self._LATEX_REPLACEMENTS[m.group(0)], text)

    def _make_env(self, template_dir: Path) -> Environment:
        env = Environment(loader=FileSystemLoader(str(template_dir)), block_start_string='\\BLOCK{', block_end_string='}', variable_start_string='\\VAR{', variable_end_string='}', comment_start_string='\\#{', comment_end_string='}', trim_blocks=True, lstrip_blocks=True, autoescape=False)
        env.filters['latex'] = self.latex_escape
        return env

    def render_resume(self, data: dict) -> str:
        template_dir = Path(__file__).resolve().parent.parent.parent / 'templates'
        env = self._make_env(template_dir)
        template = env.get_template('resume_template.tex')
        technical = dict(data.get('technical_skills') or {})
        for key in ('languages', 'backend', 'ai_ml', 'databases', 'tools'):
            val = technical.get(key, '')
            if isinstance(val, list):
                technical[key] = ', '.join((str(v) for v in val))
        context = dict(data)
        context['technical_skills'] = technical or None
        return template.render(context)
