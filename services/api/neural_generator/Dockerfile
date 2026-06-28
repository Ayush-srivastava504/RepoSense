FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --retries 5 --default-timeout 1000 --no-cache-dir -r requirements.txt

COPY src ./src

RUN mkdir -p /app/models && \
    curl -L \
    https://github.com/Ayush-srivastava504/RepoSense/releases/download/models/Qwen3-0.6B-Q4_K_M.gguf \
    -o /app/models/Qwen3-0.6B-Q4_K_M.gguf

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
 CMD curl -f http://localhost:8002/health || exit 1

CMD ["uvicorn", "src.app:app", "--host", "0.0.0.0", "--port", "8002"]