# ==========================================
# Builder Stage
# ==========================================
FROM public.ecr.aws/lambda/python:3.11 AS builder

WORKDIR /build

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

# Install dependencies except psycopg2-binary
RUN pip install --upgrade pip && \
    grep -ivE 'psycopg2-binary' requirements.txt > requirements_filtered.txt || true && \
    if [ -s requirements_filtered.txt ]; then \
        pip install \
        --no-cache-dir \
        --target /build/packages \
        -r requirements_filtered.txt; \
    fi


# ==========================================
# Final Stage
# ==========================================
FROM public.ecr.aws/lambda/python:3.11 AS final

RUN yum install -y \
    unzip \
    curl \
    wget \
    && yum clean all && \
    rm -rf /var/cache/yum

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}

RUN pip install --no-cache-dir psycopg2-binary==2.9.9

# Download Chromium
RUN curl -L \
    https://github.com/aws-samples/chromium-for-aws-lambda/releases/download/v119.0.0/chromium-v119.0.0-linux-x64.zip \
    -o /tmp/chromium.zip && \
    mkdir -p /opt/chromium && \
    unzip -q /tmp/chromium.zip -d /opt/chromium && \
    chmod +x /opt/chromium/chromium && \
    rm -f /tmp/chromium.zip

ENV CHROMIUM_PATH=/opt/chromium/chromium
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]