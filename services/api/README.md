# RepoSense Core API (`services/api`)

The primary backend service for RepoSense, powered by **FastAPI**. It provides robust RESTful APIs for authentication, job querying, ATS resume parsing, AI code review, LaTeX resume compilation, LeetCode judge evaluation, and subscription billing.

---

## 🏛️ Architecture & Folder Structure

```
services/api/
├── src/
│   ├── api/               # Auxiliary routers (code review, self-healing)
│   ├── configs/           # Pydantic settings, DB connection pooling, Redis client
│   ├── core/              # App factory, custom middlewares, global error handlers
│   ├── data/leetcode/     # LeetCode problem bank and Blind 75 dataset
│   ├── middleware/        # JWT auth verification and IP/User rate limiters
│   ├── routes/            # Core route modules (auth, jobs, resume, ats, etc.)
│   ├── schemas/           # Pydantic request/response validation schemas
│   ├── services/          # Business logic: ATS scorer, PDF compiler, GitHub sync
│   └── utils/             # Cryptography helpers, logger, ML model loader
├── database/migrations/   # Numbered SQL migrations (001_users.sql to 018_logo_domain.sql)
├── templates/             # LaTeX resume formatting templates
├── crawler/               # Scheduled job and hackathon scraper
├── rag/                   # RAG microservice with vector embeddings
├── neural_generator/      # Local LLM text generator
└── run_migrations.py      # Automated database migration runner
```

---

## 🔌 API Endpoints Reference

All routes are mounted under the `/api` prefix:

### 1. Authentication & Users (`/api/auth`)
- `POST /api/auth/otp/request`: Sends one-time login passcode to email.
- `POST /api/auth/otp/verify`: Validates OTP and issues JWT access token.
- `POST /api/auth/guest`: Spawns a temporary anonymous session.

### 2. GitHub Integration (`/api/github`)
- `GET /api/github/login`: Initiates GitHub OAuth authentication.
- `GET /api/github/callback`: Exchanges OAuth code for encrypted access token.
- `GET /api/github/repos`: Fetches candidate's public and private repositories.
- `GET /api/github/tree`: Retrieves repository directory structure for AI code review.

### 3. Job Search & Companies (`/api/jobs`, `/api/companies`)
- `GET /api/jobs`: Paginated job listings with keyword, category, and country filters.
- `GET /api/jobs/{id}`: Full job description, salary range, and company profile.
- `GET /api/jobs/featured`: Curated high-priority job openings.
- `GET /api/companies/{company}/profile`: Rich company overview, engineering culture, and active listings.

### 4. Resume & ATS Engine (`/api/resume`, `/api/ats`)
- `POST /api/resume/generate`: Compiles user profile and GitHub projects into a LaTeX PDF.
- `POST /api/ats/check`: Evaluates uploaded resume against target job description, returning a match score (0-100), missing keywords, and layout warnings.
- `POST /api/resume/cover-letter`: Drafts a tailored cover letter based on specific job criteria.

### 5. LeetCode Practice & Judge (`/api/leetcode`)
- `GET /api/leetcode/problems`: Lists coding challenges with difficulty and tag filters.
- `POST /api/leetcode/submit`: Runs code against test cases in an isolated execution sandbox.
- `GET /api/leetcode/blind75`: Returns candidate's completion tracker for the Blind 75 list.

---

## ⚙️ Environment Variables & Configuration

Configuration is loaded from environment variables via `src/configs/settings.py`:

| Variable | Description | Required |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URI | **Yes** |
| `REDIS_URL` | Redis cache and task broker URI | **Yes** |
| `JWT_SECRET` | Secret key for signing authentication tokens | **Yes** |
| `GITHUB_CLIENT_ID` | GitHub OAuth Application Client ID | Optional |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Application Client Secret | Optional |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | AES key for encrypting stored access tokens | Optional |
| `RAZORPAY_KEY_ID` / `_SECRET` | Razorpay credentials for payment checkout | Optional |
| `AWS_ACCESS_KEY_ID` / `_SECRET` | AWS S3 credentials for generated resume storage | Optional |
| `GROQ_API_KEY` | Groq API key for fast cloud LLM inference | Optional |
| `ANTHROPIC_API_KEY` | Claude API key for high-quality content generation | Optional |

---

## 🏃 Running Locally

```bash
# 1. Activate environment
source venv/bin/activate

# 2. Run migrations
python run_migrations.py

# 3. Start development server
uvicorn src.app:app --reload --host 0.0.0.0 --port 8000
```
Visit [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive OpenAPI documentation.
