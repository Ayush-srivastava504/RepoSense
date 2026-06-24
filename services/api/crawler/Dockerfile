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
    xz \
    && yum clean all \
    && rm -rf /var/cache/yum

COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    grep -ivE 'psycopg2|playwright' requirements.txt > requirements_filtered.txt || true && \
    if [ -s requirements_filtered.txt ]; then \
        pip install --target /build/packages -r requirements_filtered.txt; \
    fi

# Install Playwright Python bindings ONLY (no browser)
RUN pip install --no-cache-dir \
    --target /build/packages \
    playwright==1.44.0

# Remove Playwright's bundled Node.js and browsers
RUN find /build/packages/playwright -name "node" -type f -exec rm -f {} \; 2>/dev/null || true && \
    rm -rf /build/packages/playwright/driver 2>/dev/null || true

FROM public.ecr.aws/lambda/python:3.11 AS final

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}

RUN pip install --no-cache-dir psycopg2-binary==2.9.9

# Install chromium from Amazon Linux repository
RUN amazon-linux-extras install -y chromium && \
    mkdir -p /opt/chromium && \
    cp /usr/bin/chromium-browser /opt/chromium/chromium && \
    chmod +x /opt/chromium/chromium

# IMPORTANT: Remove Playwright's driver to force using custom Chromium
RUN rm -rf ${LAMBDA_TASK_ROOT}/playwright/driver 2>/dev/null || true

# Environment variables
ENV CHROMIUM_PATH=/opt/chromium/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_NODEJS_PATH=/opt/chromium/chromium

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]