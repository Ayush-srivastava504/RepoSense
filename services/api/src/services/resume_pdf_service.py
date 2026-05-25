import subprocess
import os
from pathlib import Path


class ResumePDFService:

    async def compile_latex(
        self,
        title: str,
        latex_content: str,
    ):

        output_dir = Path(
            "generated_resumes"
        )

        output_dir.mkdir(
            exist_ok=True
        )

        tex_path = (
            output_dir /
            f"{title}.tex"
        )

        pdf_path = (
            output_dir /
            f"{title}.pdf"
        )

        with open(
            tex_path,
            "w",
            encoding="utf-8"
        ) as f:

            f.write(
                latex_content
            )

        try:
            result = subprocess.run(
                [
                    r"E:\latex\miktex\bin\x64\pdflatex.exe",
                    "-interaction=nonstopmode",
                    "-output-directory",
                    str(output_dir),
                    str(tex_path),
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                log_path = output_dir / f"{title}.log"
                error_msg = result.stderr or result.stdout
                
                if log_path.exists():
                    with open(log_path, "r", encoding="utf-8", errors="ignore") as log_file:
                        log_content = log_file.read()
                        # Extract the LaTeX error lines
                        lines = log_content.split("\n")
                        error_lines = [l for l in lines if "Error:" in l or "Missing" in l or "\\item" in l]
                        if error_lines:
                            error_msg = "\n".join(error_lines[:10])
                
                raise RuntimeError(
                    f"LaTeX compilation failed:\n{error_msg}\n\nCheck generated .tex file at {tex_path} for details."
                )

        except FileNotFoundError:
            raise RuntimeError(
                f"pdflatex not found at E:\\latex\\miktex\\bin\\x64\\pdflatex.exe. "
                f"Please ensure MiKTeX is installed."
            )

        return str(pdf_path)