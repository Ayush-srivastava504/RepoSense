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

# Download Chromium using Pyppeteer
ENV PYPPETEER_HOME=/opt/pyppeteer

RUN python -c "from pyppeteer.chromium_downloader import download_chromium; download_chromium()"

ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]