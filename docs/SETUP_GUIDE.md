# Internship Platform - Setup Guide

## 1. DATABASE MIGRATIONS

### Quick Start (Recommended)

```powershell
# Option A: Using the Python migration runner
python run_migrations.py

# Option B: Using Makefile (Linux/Mac)
make migrate

# Option C: Manual with psql
psql "postgresql://postgres:postgres@localhost:5432/postgres" -f database/migrations/001_users.sql
psql "postgresql://postgres:postgres@localhost:5432/postgres" -f database/migrations/002_resumes.sql
psql "postgresql://postgres:postgres@localhost:5432/postgres" -f database/migrations/003_jobs.sql
psql "postgresql://postgres:postgres@localhost:5432/postgres" -f database/migrations/004_subscriptions.sql
```

### What Each Migration Does

| File | Creates | Purpose |
|------|---------|---------|
| `001_users.sql` | `users` table | Stores user accounts, GitHub tokens, subscription tier |
| `002_resumes.sql` | `resumes` table | Stores user-created resumes |
| `003_jobs.sql` | `jobs` table | Stores scraped internship/job postings |
| `004_subscriptions.sql` | `subscriptions` table | Stores Razorpay payment info |
| `005_repo_docs.sql` | `repo_docs` table | Stores GitHub repository documentation |

### Database Schema

```sql
-- Users: Stores accounts and GitHub tokens
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    subscription_tier TEXT DEFAULT 'free',
    github_token TEXT,              -- encrypted GitHub access token
    created_at TIMESTAMP DEFAULT NOW()
);

-- Resumes: User-created resumes
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content JSONB NOT NULL,         -- stores resume structure as JSON
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs: Scraped internship/job listings
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    url TEXT UNIQUE,
    source TEXT,                    -- which scraper found this (indeed, linkedin, etc)
    posted_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Subscriptions: Razorpay payment records
-- Repo Docs: GitHub repository documentation
```

---

## 2. CRAWLER - WHERE JOBS ARE SAVED

### Flow: Job Scraping → Storage

```
Scraper (Indeed, LinkedIn, etc)
    ↓
Normalizer (clean & standardize)
    ↓
Deduplicator (remove duplicates)
    ↓
S3 (Raw NDJSON files) ← **First storage**
    ↓
PostgreSQL (jobs table) ← **Final storage**
```

### Storage Locations

#### A. AWS S3 (Raw Data)
- **Bucket**: `job-crawler-raw` (default, configurable via `S3_BUCKET` in `.env`)
- **Path Structure**: `jobs/{source}/{date}/{timestamp}.ndjson`

**Example**:
```
s3://job-crawler-raw/jobs/indeed/2026-05-17/2026-05-17T13-19-46.ndjson
s3://job-crawler-raw/jobs/linkedin/2026-05-17/2026-05-17T13-25-12.ndjson
s3://job-crawler-raw/jobs/naukri/2026-05-17/2026-05-17T13-30-45.ndjson
```

**Format**: NDJSON (one JSON object per line)
```json
{"id":"indeed_12345","title":"Python Developer Intern","company":"TechCorp","location":"Bangalore","salary":"10000-15000 INR","source":"indeed","url":"https://..."}
{"id":"indeed_12346","title":"Data Science Intern","company":"DataFirm","location":"Mumbai","salary":"12000-18000 INR","source":"indeed","url":"https://..."}
```

#### B. PostgreSQL (Processed Data)
- **Database**: `postgres` (or `internship_db` if you changed it)
- **Table**: `jobs`
- **Host**: `localhost:5432` (default)
- **Credentials**: `postgres:postgres` (from `.env`)

**Query to see all scraped jobs**:
```sql
SELECT id, title, company, source, posted_at 
FROM jobs 
WHERE is_active = true 
ORDER BY posted_at DESC 
LIMIT 50;
```

### Crawler Configuration

Located in: `services/api/crawler/src/config.py`

**Key Settings**:
```python
# Storage
S3_BUCKET = os.getenv("S3_BUCKET", "job-crawler-raw")
S3_PREFIX = os.getenv("S3_PREFIX", "jobs/")  # S3 path prefix
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "jobs")  # Alternative: DynamoDB

# Crawl Settings
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "8"))  # parallel scrapers
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))  # seconds per request

# What to scrape
DEFAULT_KEYWORDS = [
    "internship",
    "fresher",
    "graduate trainee",
    "junior developer",
    "software engineer intern",
    "data science intern",
    "ML intern",
]

DEFAULT_LOCATIONS = [
    "Bangalore", "Mumbai", "Delhi", "Pune", ...
]

# Enabled scrapers
ENABLED_SCRAPERS = [
    "linkedin",
    "indeed", 
    "naukri",
    "internshala",
    "wellfound",
    "glassdoor",
    "cutshort",
    "unstop",
]
```

### Running the Crawler

```powershell
# Navigate to crawler directory
cd e:\Repo_Sense\services\api\crawler

# Install dependencies
pip install -r requirements.txt

# Run the crawler
python src/index.py

# Or run a specific scraper
python -m src.scrapers.indeed
```

---

## 3. FIXING TERMINAL ERRORS

### Common Errors & Solutions

#### Error 1: `ConnectionResetError: An existing connection was forcibly closed`
**Cause**: PostgreSQL or Redis not running
**Solution**:
```powershell
# Windows: Start PostgreSQL service
net start PostgreSQL14  # adjust version number

# Or use Docker (recommended)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

# Start Redis
docker run -d -p 6379:6379 redis:latest
```

#### Error 2: `redis.exceptions.ConnectionError`
**Cause**: Redis connection failed in rate-limiting middleware
**Status**: **FIXED** - Rate limiter now skips if Redis is unavailable

#### Error 3: `AttributeError: 'NoneType' object has no attribute ...`
**Cause**: DB pool is None and code tries to call methods on it
**Status**: **FIXED** - All routes now check `if pool is None: raise HTTPException(503)`

#### Error 4: `NameError: name 'get_db_pool' is not defined`
**Cause**: Missing import in route files
**Status**:  **FIXED** - All imports added

#### Error 5: `ModuleNotFoundError: No module named '...'`
**Cause**: Missing dependencies
**Solution**:
```powershell
cd e:\Repo_Sense\services\api
pip install -r requirements.txt
```

### How to Run Without Errors

**Step 1: Start Dependencies**
```powershell
# Option A: Use Docker (easiest)
cd e:\Repo_Sense\infrastructure\docker
docker-compose up -d

# Option B: Start manually
# Terminal 1: PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

# Terminal 2: Redis
docker run -d -p 6379:6379 redis:latest
```

**Step 2: Run Migrations**
```powershell
cd e:\Repo_Sense
python run_migrations.py
```

**Step 3: Start Backend**
```powershell
cd e:\Repo_Sense\services\api
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.core.app:app --reload --host 0.0.0.0 --port 8000
```

**Step 4: Start Frontend**
```powershell
cd e:\Repo_Sense\apps\web
npm install
npm run dev
```

**Step 5: Test**
```powershell
# Test backend
curl http://localhost:8000/health
# Should return: {"status": "ok"}

# Test API
curl http://localhost:8000/api/resume/list
# Should return: [] (or 401 if not authenticated)
```

---

## 4. ENVIRONMENT VARIABLES

Update `.env` in `e:\Repo_Sense\` with:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379/0

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/github/callback

# JWT
JWT_SECRET=your_secret_key_here

# Encryption
GITHUB_TOKEN_ENCRYPTION_KEY=your_32_char_encryption_key_________

# AWS (for crawler S3 storage)
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET_KEY=your_aws_secret
S3_BUCKET=job-crawler-raw

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Frontend
FRONTEND_URL=http://localhost:3000

# API
API_HOST=0.0.0.0
API_PORT=8000
ENVIRONMENT=development
```

---

## Quick Troubleshooting Checklist

- [ ] PostgreSQL running? → `docker ps | grep postgres`
- [ ] Redis running? → `docker ps | grep redis`
- [ ] Migrations completed? → `python run_migrations.py`
- [ ] `.env` file exists? → Check `e:\Repo_Sense\.env`
- [ ] Dependencies installed? → `pip install -r requirements.txt`
- [ ] Backend starts? → `uvicorn src.core.app:app --reload`
- [ ] Frontend starts? → `npm run dev` in `apps/web`
- [ ] API responds? → `curl http://localhost:8000/health`

---

## Support

If you still see errors, share:
1. The exact error message
2. Which step failed
3. Output of: `python run_migrations.py` or `uvicorn src.core.app:app --reload`
