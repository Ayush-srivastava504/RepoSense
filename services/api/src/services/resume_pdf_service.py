import subprocess
import shutil
from pathlib import Path

class ResumePDFService:
    def __init__(self, pdflatex_path: str = None):
        if pdflatex_path is None:
            self.pdflatex_path = shutil.which("pdflatex")
        else:
            self.pdflatex_path = pdflatex_path

        if not self.pdflatex_path:
            raise RuntimeError(
                "pdflatex not found. Install TeX Live and ensure pdflatex is in PATH."
            )

    async def compile_latex(self, title: str, latex_content: str, output_dir: str = "/tmp") -> str:
        workdir = Path(output_dir) / title
        workdir.mkdir(parents=True, exist_ok=True)

        tex_path = workdir / f"{title}.tex"
        tex_path.write_text(latex_content, encoding="utf-8")

        for _ in range(2):  # run twice for references
            result = subprocess.run(
                [
                    self.pdflatex_path,
                    "-interaction=nonstopmode",
                    "-output-directory",
                    str(workdir),
                    str(tex_path),
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",  # NEW — pdflatex stdout/stderr isn't guaranteed valid UTF-8;
                                   # without this, any stray byte crashes subprocess.run() itself
                                   # before you ever see the real LaTeX error
                cwd=str(workdir),
            )
            if result.returncode != 0:
                # Extract detailed error from log file
                log_path = workdir / f"{title}.log"
                error_details = result.stderr or result.stdout or ""
                if log_path.exists():
                    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                        log_content = f.read()
                        # Find lines with errors, plus several lines of context after
                        # each match — pdflatex prints the offending line number
                        # (e.g. "l.87 \section{Projects}") several lines after the
                        # "! ..." error line itself (after the "Type H for help"
                        # boilerplate), so a keyword-only filter silently drops the
                        # one line that actually tells you where the bug is.
                        log_lines = log_content.split("\n")
                        error_lines = []
                        seen_indices = set()
                        for i, line in enumerate(log_lines):
                            if "Error" in line or line.strip().startswith("!") or "Missing" in line:
                                for j in range(i, min(i + 8, len(log_lines))):
                                    if j not in seen_indices:
                                        seen_indices.add(j)
                                        error_lines.append(log_lines[j])
                            if len(error_lines) >= 30:
                                break
                        if error_lines:
                            error_details = "\n".join(error_lines)
                raise RuntimeError(f"pdflatex failed:\n{error_details}")

        pdf_path = workdir / f"{title}.pdf"
        if not pdf_path.exists():
            raise RuntimeError("PDF not generated")
        return str(pdf_path)