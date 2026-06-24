# Stage 1: Build dependencies
FROM public.ecr.aws/lambda/python:3.11 AS builder

WORKDIR /build

# Install system dependencies
RUN yum install -y \
    gcc \
    gcc-c++ \
    make \
    tar \
    unzip \
    curl \
    wget \
    && yum clean all \
    && rm -rf /var/cache/yum

# Copy and install Python dependencies
COPY requirements.txt .

# Filter out psycopg2 and playwright
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

# Install Playwright Python bindings only (no browser)
RUN pip install --no-cache-dir \
    --target /build/packages \
    playwright==1.44.0

# Stage 2: Final Lambda image
FROM public.ecr.aws/lambda/python:3.11 AS final

LABEL maintainer="platform-team"
LABEL description="Job aggregator crawler Lambda"

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}

RUN pip install --no-cache-dir \
    psycopg2-binary==2.9.9

# Chromium will come from the Lambda Layer (sparticuz/chromium)
# Set environment variables to point to the layer
ENV CHROMIUM_PATH=/opt/chromium/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]