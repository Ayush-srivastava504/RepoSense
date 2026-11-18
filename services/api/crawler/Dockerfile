# Job crawler image. Built by GitHub Actions and pushed to GHCR; on the server it runs on a
# schedule via `docker compose --profile jobs run --rm crawler` (see docs/DEPLOYMENT_GUIDE.md).
FROM python:3.11-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HEADLESS=true \
    PYTHONPATH=/app/src \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

COPY src/ /app/src/

CMD ["python", "src/index.py", "--max-pages", "2"]
