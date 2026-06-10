FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libpq-dev \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --retries 5 --default-timeout 1000 --no-cache-dir -r requirements.txt

COPY src ./src
COPY ./templates /app/templates

ENV PYTHONPATH=/app/src

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
 CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "core.app:app", "--host", "0.0.0.0", "--port", "8000"]