# Build from the repo root:  docker build -f services/company_intel/Dockerfile -t company-intel .
FROM python:3.12-slim
WORKDIR /app
COPY services/company_intel/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/company_intel/company_intel ./company_intel
# llm_providers.py only needs httpx; vendored so this image does not ship the whole API.
COPY services/api/src/services/llm_providers.py ./company_intel/vendor/llm_providers.py
CMD ["python", "-m", "company_intel.run", "all", "--limit", "50"]
