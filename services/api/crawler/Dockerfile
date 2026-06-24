FROM mcr.microsoft.com/playwright/python:v1.44.0-jammy AS builder

WORKDIR /build

COPY requirements.txt .

RUN pip install --upgrade pip && \
    pip install \
        --retries 5 \
        --default-timeout 1000 \
        --no-cache-dir \
        --target /build/packages \
        -r requirements.txt

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN playwright install chromium

FROM public.ecr.aws/lambda/python:3.11 AS final

LABEL maintainer="platform-team"
LABEL description="Job aggregator crawler Lambda"

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}
COPY --from=builder /ms-playwright /ms-playwright

ENV CHROME_BINARY=/usr/bin/chromium-browser
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

HEALTHCHECK \
    --interval=60s \
    --timeout=10s \
    --retries=2 \
    CMD python -c "import index; print('ok')"

CMD ["index.lambda_handler"]

FROM python:3.11-slim AS dev

WORKDIR /app

RUN apt-get update && \
    apt-get install -y \
        --no-install-recommends \
        gcc \
        libxml2-dev \
        libxslt-dev \
        curl \
        chromium \
        chromium-driver \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install \
        --no-cache-dir \
        -r requirements.txt && \
    playwright install chromium \
        2>/dev/null || true

ENV CHROME_BINARY=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver
ENV HEADLESS=true
ENV PYTHONPATH=/app/src

COPY src/ /app/src/

CMD ["python", "src/index.py", "--max-pages", "2"]