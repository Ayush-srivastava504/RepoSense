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

# Chromium/Playwright runtime deps. Lambda's base image is minimal;
# headless Chromium needs these shared libs or it fails to even launch
# (separate from, and in addition to, the network/path issues).
RUN yum install -y \
    unzip \
    curl \
    wget \
    atk \
    cups-libs \
    gtk3 \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    pango \
    alsa-lib \
    at-spi2-atk \
    at-spi2-core \
    mesa-libgbm \
    nss \
    nspr \
    && yum clean all \
    && rm -rf /var/cache/yum

COPY --from=builder /build/packages ${LAMBDA_TASK_ROOT}

RUN pip install --no-cache-dir psycopg2-binary==2.9.9 playwright==1.45.0

# ------------------------------------------------------------------
# IMPORTANT: everything below installs into /opt, NEVER /tmp.
# Lambda mounts a fresh, EMPTY ephemeral volume over /tmp on every
# cold start of every execution environment. Anything baked into
# /tmp at `docker build` time is invisible at runtime. /opt (and the
# rest of the image filesystem) persists correctly and is read-only
# at runtime, which is fine since we only need to read the binaries.
# ------------------------------------------------------------------

ENV PYPPETEER_HOME=/opt/pyppeteer
ENV PYPPETEER_CHROMIUM_REVISION=899643

RUN python -c "import os; os.environ['PYPPETEER_HOME']='/opt/pyppeteer'; from pyppeteer.chromium_downloader import download_chromium; download_chromium()" \
    && find /opt/pyppeteer -maxdepth 4 -iname "*chrome*" -print

# Resolve and bake the exact executable path so the app never has to
# probe /tmp or guess at runtime.
RUN CHROME_BIN=$(find /opt/pyppeteer -maxdepth 4 -iname "chrome" -type f | head -n1) && \
    echo "Resolved pyppeteer chrome at: ${CHROME_BIN}" && \
    test -x "${CHROME_BIN}" && \
    echo "${CHROME_BIN}" > /opt/pyppeteer/chrome_path.txt

ENV PYPPETEER_CHROMIUM_PATH=/opt/pyppeteer/local-chromium/899643/chrome-linux/chrome

# Playwright browsers (used by LinkedInScraper) -- separate from
# pyppeteer, must be installed independently.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers

RUN python -m playwright install chromium \
    && python -m playwright install-deps chromium || true \
    && find /opt/playwright-browsers -maxdepth 3 -iname "*chrome*" -print

ENV HEADLESS=true
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR ${LAMBDA_TASK_ROOT}

COPY src/ .

CMD ["index.lambda_handler"]