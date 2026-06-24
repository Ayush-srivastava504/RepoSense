FROM public.ecr.aws/lambda/python:3.11 AS builder

WORKDIR /build

# Install system dependencies for building/installing Chromium
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

RUN pip install --upgrade pip && \
    grep -ivE 'psycopg2|playwright' requirements.txt > requirements_filtered.txt || true && \
    if [ -s requirements_filtered.txt ]; then \
        pip install --target /build/packages -r requirements_filtered.txt; \
    fi

RUN pip install --no-cache-dir \
    --target /build/packages \
    playwright==1.44.0

# Download and extract Chromium for Amazon Linux 2
RUN mkdir -p /opt/chromium && \
    curl -L "https://github.com/Sparticuz/chromium/releases/download/v119.0.0/chromium-v119.0.0-linux-x64.zip" \
        -o /tmp/chromium.zip && \
    unzip /tmp/chromium.zip -d /opt/chromium/ && \
    chmod +x /opt/chromium/chromium && \
    rm /tmp/chromium.zip

FROM public.ecr.aws/lambda/python:3.11 AS final

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}
COPY --from=builder /opt/chromium /opt/chromium

RUN pip install --no-cache-dir psycopg2-binary==2.9.9

# Chromium is now built into the image
ENV CHROMIUM_PATH=/opt/chromium/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]