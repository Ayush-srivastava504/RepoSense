# Stage 1: Build dependencies (Amazon Linux 2 compatible)
FROM public.ecr.aws/lambda/python:3.11 AS builder

WORKDIR /build

# Install system dependencies needed for Playwright on AL2
RUN yum install -y \
    gcc \
    gcc-c++ \
    make \
    tar \
    unzip \
    curl \
    wget \
    xz \
    && yum clean all \
    && rm -rf /var/cache/yum

# Copy and install Python dependencies
COPY requirements.txt .

# Filter out psycopg2 and playwright (we'll install them separately)
RUN pip install --upgrade pip && \
    grep -ivE 'psycopg2|playwright' requirements.txt > requirements_filtered.txt || true && \
    if [ -s requirements_filtered.txt ]; then \
        pip install \
            --retries 5 \
            --default-timeout 1000 \
            --no-cache-dir \
            --target /build/packages \
            -r requirements_filtered.txt; \
    fi

# Install Playwright Python bindings (without the bundled Node/Chromium)
RUN pip install --no-cache-dir \
    --target /build/packages \
    playwright==1.44.0

# Install sparticuz chromium (compiled for Amazon Linux 2)
# Using the correct URL format from sparticuz/chromium releases
RUN mkdir -p /opt/chromium && \
    curl -L "https://github.com/Sparticuz/chromium/releases/download/v119.0.0/chromium-v119.0.0-linux-x64.zip" \
        -o /tmp/chromium.zip && \
    unzip /tmp/chromium.zip -d /opt/chromium/ && \
    chmod +x /opt/chromium/chromium && \
    rm /tmp/chromium.zip

# Stage 2: Final Lambda image
FROM public.ecr.aws/lambda/python:3.11 AS final

LABEL maintainer="platform-team"
LABEL description="Job aggregator crawler Lambda"

# Copy Python packages from builder
COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}

# Copy sparticuz chromium
COPY --from=builder /opt/chromium /opt/chromium

# Install psycopg2-binary (compatible with AL2)
RUN pip install --no-cache-dir \
    psycopg2-binary==2.9.9

# Set environment variables for Playwright to use sparticuz chromium
ENV CHROMIUM_PATH=/opt/chromium/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR ${LAMBDA_TASK_ROOT}

# Copy source code
COPY src/ .

# Create symlink for compatibility
RUN mkdir -p /home/sbx_user && chmod 777 /home/sbx_user

HEALTHCHECK \
    --interval=60s \
    --timeout=10s \
    --retries=2 \
    CMD python -c "import index; print('ok')" || exit 1

CMD ["index.lambda_handler"]

# Stage 3: Development environment (optional)
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
        wget \
        unzip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install \
        --no-cache-dir \
        -r requirements.txt && \
    playwright install chromium || true

ENV CHROME_BINARY=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver
ENV HEADLESS=true
ENV PYTHONPATH=/app/src
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

COPY src/ /app/src/

CMD ["python", "src/index.py", "--max-pages", "2"]