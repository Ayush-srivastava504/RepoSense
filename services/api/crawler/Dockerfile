FROM public.ecr.aws/lambda/python:3.11 AS builder

WORKDIR /build

COPY requirements.txt .

RUN pip install --upgrade pip && \
    grep -ivE 'psycopg2|playwright' requirements.txt > requirements_filtered.txt || true && \
    if [ -s requirements_filtered.txt ]; then \
        pip install --target /build/packages -r requirements_filtered.txt; \
    fi

RUN pip install --no-cache-dir \
    --target /build/packages \
    playwright==1.44.0

FROM public.ecr.aws/lambda/python:3.11 AS final

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}

RUN pip install --no-cache-dir psycopg2-binary==2.9.9

# Chromium comes from the Lambda Layer
ENV CHROMIUM_PATH=/opt/chromium/chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/chromium
ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]