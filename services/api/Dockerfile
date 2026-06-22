FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    libpq-dev \
    postgresql-client \
    unzip \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    && rm -rf /var/lib/apt/lists/*

# Install fontawesome5 LaTeX package manually (avoids the ~400MB texlive-fonts-extra collection).
# pdflatex needs Type1 (.pfb) + tfm/vf metric files, plus the .def mapping files
# that fontawesome5.sty loads for icon-name lookups (e.g. fontawesome5-mapping.def).
RUN mkdir -p /tmp/fa5 \
    && curl -fsSL https://mirrors.ctan.org/fonts/fontawesome5.zip -o /tmp/fa5.zip \
    && unzip -q /tmp/fa5.zip -d /tmp/fa5 \
    && mkdir -p /usr/share/texmf/tex/latex/fontawesome5 \
               /usr/share/texmf/fonts/opentype/public/fontawesome5 \
               /usr/share/texmf/fonts/type1/public/fontawesome5 \
               /usr/share/texmf/fonts/tfm/public/fontawesome5 \
               /usr/share/texmf/fonts/vf/public/fontawesome5 \
               /usr/share/texmf/fonts/map/dvips/fontawesome5 \
    && find /tmp/fa5 -name "*.sty" -exec cp {} /usr/share/texmf/tex/latex/fontawesome5/ \; \
    && find /tmp/fa5 -name "*.def" -exec cp {} /usr/share/texmf/tex/latex/fontawesome5/ \; \
    && find /tmp/fa5 -name "*.otf" -exec cp {} /usr/share/texmf/fonts/opentype/public/fontawesome5/ \; \
    && find /tmp/fa5 -name "*.pfb" -exec cp {} /usr/share/texmf/fonts/type1/public/fontawesome5/ \; \
    && find /tmp/fa5 -name "*.tfm" -exec cp {} /usr/share/texmf/fonts/tfm/public/fontawesome5/ \; \
    && find /tmp/fa5 -name "*.vf" -exec cp {} /usr/share/texmf/fonts/vf/public/fontawesome5/ \; \
    && find /tmp/fa5 -name "*.map" -exec cp {} /usr/share/texmf/fonts/map/dvips/fontawesome5/ \; \
    && texhash \
    && rm -rf /tmp/fa5 /tmp/fa5.zip

COPY requirements.txt .

RUN pip install --retries 5 --default-timeout 1000 --no-cache-dir -r requirements.txt

COPY src ./src
COPY ./templates /app/templates

# Copy migrations so entrypoint.sh can run them
COPY database/migrations ./database/migrations

# Copy and wire up entrypoint
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV PYTHONPATH=/app/src

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]