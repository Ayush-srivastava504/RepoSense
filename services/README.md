# 🚀 Repo Sense Backend Services

Complete backend infrastructure for the AI Code Review Platform, featuring microservices architecture with API, neural generation, RAG (Retrieval-Augmented Generation), and web scraping capabilities.

## 📋 Architecture Overview

```
services/
├── app.py                              # Main entry point
├── requirements.txt                    # Python dependencies
├── Dockerfile                          # Container configuration
├── entrypoint.sh                       # Startup script
├── README.md                           # This file
│
├── api/                                # FastAPI application
│   ├── src/
│   │   ├── core/                       # Core FastAPI setup
│   │   ├── routes/                     # API endpoints
│   │   ├── services/                   # Business logic
│   │   ├── middleware/                 # Auth & rate limiting
│   │   ├── configs/                    # Settings (unified)
│   │   ├── utils/                      # Helpers
│   │   └── models/                     # ML models
│   │
│   ├── crawler/                        # Job scraper (9+ sites)
│   ├── neural-generator/               # Qwen GGUF text generation
│   ├── rag/                            # Retrieval-Augmented Generation
│   └── test_imports.py                 # Validation
│
└── infrastructure/
    └── docker/
        ├── docker-compose.yml          # Local dev
        └── docker-compose.prod.yml     # Production
```

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **API Framework** | FastAPI + Pydantic |
| **Database** | PostgreSQL (async with asyncpg) |
| **Cache** | Redis (optional) |
| **Code Analysis** | Pattern matching + CodeBERT ONNX (optional) |
| **Text Generation** | llama-cpp-python (Qwen GGUF) |
| **Vector Search** | FAISS |
| **Web Scraping** | Playwright, BeautifulSoup |
| **Authentication** | JWT + Fernet encryption |
| **Payments** | Stripe webhooks |

## 🚀 Quick Start

### Prerequisites

```bash
# Required
- Python 3.11+
- PostgreSQL 12+

# Optional
- Redis (caching)
- Docker (containerization)
```

### Installation

```bash
# 1. Navigate to services
cd services

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\Activate.ps1

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db
REDIS_URL=redis://localhost:6379/0
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
JWT_SECRET=your_secret_min_32_chars
GITHUB_TOKEN_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FRONTEND_URL=http://localhost:3000
MODEL_PATH=/app/models/qwen3-codersmall-0.8b-q4_k_m.gguf
CODEBERT_ONNX_PATH=/app/models/codebert_quantized.onnx
EOF

# 5. Run migrations
python run_migrations.py

# 6. Start API
python app.py
```

**API available at:** http://localhost:8000  
**Docs:** http://localhost:8000/docs

## 📚 Service Documentation

### API Service (`services/api/src/`)

Main FastAPI application.

**Key Endpoints:**

```
AUTH
  POST   /api/auth/register           Register user
  POST   /api/auth/login              Email login
  GET    /api/auth/me                 Current user

GITHUB
  GET    /api/github/login            Start OAuth
  GET    /api/github/callback         OAuth callback
  GET    /api/github/repos            List repos
  GET    /api/github/file             Get file content
  POST   /api/github/index-repo       Index for RAG

CODE REVIEW
  POST   /api/review                  Submit code
  GET    /api/review/{id}             Get results

RESUMES
  POST   /api/resume/upload           Upload file
  GET    /api/resume/{id}             Get resume
  POST   /api/resume/{id}/analyze     AI analysis

JOBS
  GET    /api/jobs                    List jobs
  POST   /api/jobs/{id}/apply         Apply

SUBSCRIPTIONS
  GET    /api/subscription/status     Check tier
  POST   /api/subscription/upgrade    Upgrade
```

**Architecture:**

- Request → Middleware (Auth, Rate Limit) → Route Handler → Service → Database
- Async/await throughout for high performance
- Optional Redis caching for reviews (5 min TTL)

### Crawler Service (`services/api/crawler/`)

Automated job scraper for 9+ job sites.

**Supported Sites:**
- LinkedIn, Indeed, Naukri, Internshala, Wellfound
- Unstop, Glassdoor, Cutshort, Company Portals

**Running:**

```bash
cd services/api/crawler/src
python index.py                                    # Default
python index.py --scrapers linkedin indeed --max-pages 5  # Custom
```

**Pipeline:** Scrape → Normalize → Deduplicate → Enrich → Store

### Neural Generator (`services/api/neural-generator/`)

**llama-cpp-python** service for Qwen GGUF text generation.

**Endpoints:**

```
POST /generate
  { prompt: str, max_tokens: 512, temperature: 0.2 }

GET /health
```

**Running:**

```bash
cd services/api/neural-generator
python -m uvicorn src.app:app --host 0.0.0.0 --port 8001
```

**Model:** Qwen3-0.6B Q4_K_M GGUF (~400MB, CPU-only, 2 threads)

### RAG Service (`services/api/rag/`)

Retrieval-Augmented Generation for README generation.

**Endpoints:**

```
POST /api/rag/index          Index repo files
POST /api/rag/generate       Generate README
GET  /api/rag/search         Search indexed files
```

**Architecture:** Files → Embeddings → FAISS Index → Retriever → LLM

## 🔐 Environment Variables

### Required

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
GITHUB_CLIENT_ID=xxxx
GITHUB_CLIENT_SECRET=xxxx
JWT_SECRET=your_secret_min_32_chars
GITHUB_TOKEN_ENCRYPTION_KEY=<Fernet key>
```

### Optional

```bash
REDIS_URL=redis://localhost:6379/0
STRIPE_SECRET_KEY=sk_test_xxx
AWS_ACCESS_KEY=xxx
MODEL_PATH=/app/models/qwen3-0.6b-q4_k_m.gguf
CODEBERT_ONNX_PATH=/app/models/codebert_quantized.onnx
SCRAPER_DEBUG=false
```

## 📊 Database

**Tables:**
- `users` - User accounts & GitHub tokens (encrypted)
- `jobs` - Job postings (id, title, company, description, url, source, posted_at)
- `resumes` - Resume uploads with AI analysis
- `subscriptions` - Payment records
- `repo_docs` - Generated READMEs

**Migrations:** `database/migrations/*.sql`

## 🐳 Docker

### Development

```bash
docker-compose up -d
docker-compose logs -f api
docker-compose down
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testing

```bash
pytest tests/
pytest tests/ --cov=api
pytest tests/test_imports.py
```

## 📈 Performance

| Feature | Details |
|---------|---------|
| **Caching** | Redis (5 min TTL for reviews) |
| **Rate Limit** | 100 req/min per IP (500 for auth users) |
| **Async** | All endpoints use async/await |
| **DB Pool** | 5 max connections |

## 🚢 Deployment

### Railway.app (Free tier friendly)

```bash
railway link
railway deploy
```

### Traditional VPS

```bash
sudo systemctl start repo-sense-api
sudo journalctl -u repo-sense-api -f
```

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| API won't start | Run: `pytest tests/test_imports.py` |
| Database connection fails | Check `DATABASE_URL` env var |
| Redis unavailable | Optional; app works without it |
| Encryption key invalid | Regenerate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| Migrations fail | Drop tables: `DROP TABLE ... CASCADE;` |

## 📖 Related Docs

- **Frontend**: [apps/web/README.md](../apps/web/README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](./api/neural-generator/README.md)
- **RAG**: [services/api/rag/README.md](./api/rag/README.md)
- **Crawler**: [services/api/crawler/README.md](./api/crawler/README.md)

## 📝 Swagger Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## ✨ Features

✅ OAuth 2.0 GitHub login  
✅ JWT stateless authentication  
✅ Code review with AI analysis  
✅ Auto-fix suggestions  
✅ 9+ job site scraping  
✅ RAG-powered documentation  
✅ Rate limiting & caching  
✅ Async/high performance  
✅ Stripe payments  
✅ Free tier AWS t2.micro compatible  

## 📄 License

Part of Repo Sense project
