# RepoSense – AI-Powered Code Review & Resume Intelligence Platform

## Overview

RepoSense is a **full-stack, production-grade platform** that combines intelligent job aggregation, resume analysis, and AI-driven code reviews. It features:

- **Job Crawler**: Aggregates positions from 9+ job boards (LinkedIn, Indeed, Naukri, Internshala, Wellfound, Unstop, Glassdoor, Cutshort)
- **AI Code Reviews**: Instant, contextual feedback on code quality, bugs, and readability
- **Resume Intelligence**: Analyze resumes against job listings and provide AI-driven insights
- **RAG Service**: Retrieval-Augmented Generation for context-aware documentation and recommendations
- **Neural Generator**: Local LLM inference for content generation with minimal resource overhead
- **Modern Frontend**: Next.js UI with GitHub OAuth, real-time terminal, and subscription management

## Key Features

- **Multi-Platform Job Aggregation**: 9+ integrated sources with real-time scraping
- **AI-Powered Code Analysis**: Multi-language support (Python, TypeScript, etc.) with confidence scoring
- **Resume Parsing & Matching**: Extract skills, experience, and match against opportunities
- **Semantic Search**: FAISS-powered vector embeddings for intelligent document retrieval
- **Low-Resource LLM**: Qwen GGUF quantized model (~400MB) runs on CPU/t2.micro
- **Batch Processing**: Handle up to 50 files per request with sub-1s latency
- **GitHub Integration**: OAuth 2.0 login, repository browser, auto-README generation
- **Razorpay Integration**: Secure payment processing with subscription management for free & premium tiers
- **Production Ready**: Docker-Compose, Railway deployment, comprehensive testing
- **Extensible Architecture**: Add custom scrapers, analysis rules, and detection patterns

## Quick Start

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **PostgreSQL** 12+
- **Docker** (optional, but recommended)

### 5-Minute Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd RepoSense

# 2. Install and activate Python environment
cd services
python -m venv venv
source venv/bin/activate      # Linux/Mac
# OR
venv\Scripts\activate          # Windows

# 3. Install backend dependencies
pip install -r requirements.txt

# 4. Initialize database
python run_migrations.py

# 5. Start backend (opens http://localhost:8000)
python app.py

# 6. In a new terminal, start frontend
cd ../apps/web
npm install
npm run dev                    # Opens http://localhost:3000
```

**That's it!** The full platform is running. Visit http://localhost:3000 to see the UI.

### Using Docker (Recommended for Production)

```bash
# Start all services with Docker Compose
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# View logs
docker-compose logs -f api
```

See [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for production deployment instructions.

## Project Structure

```
RepoSense/
├── README.md                          # Main project overview (this file)
├── OVERVIEW.md                        # Executive summary & architecture
├── docs/
│   ├── SETUP_GUIDE.md                # Detailed setup instructions
│   ├── SETUP_COMPLETE.md             # Model configuration guide
│   ├── DEPLOYMENT_GUIDE.md           # Production deployment guide
│   ├── COMPLETE_MODEL_MIGRATION_GUIDE.md  # Model migration details
│   └── MODEL_CONFIGURATION.md        # Environment variables reference
├── Makefile                           # Helper commands (install, test, build)
├── package.json                       # Monorepo workspace definition
├── railway.json                       # Railway.app deployment config
├── run_migrations.py                 # Database migration runner
│
├── apps/web/                          # Next.js Frontend
│   ├── README.md                      # Frontend-specific docs
│   ├── app/                           # Next.js App Router pages
│   │   ├── layout.tsx                 # Root layout (auth context)
│   │   ├── page.tsx                   # Home page
│   │   └── (auth)/                    # Protected routes
│   │       ├── dashboard/             # Main user dashboard
│   │       ├── github/                # GitHub OAuth & repo browser
│   │       ├── jobs/                  # Job listings & matching
│   │       ├── resume/                # Resume upload & analysis
│   │       ├── login/                 # GitHub login flow
│   │       └── register/              # User registration
│   ├── components/
│   │   └── github/                    # GitHub-specific components
│   │       └── Terminal.tsx           # WebSocket terminal component
│   ├── lib/
│   │   ├── api.ts                     # API client with auth
│   │   ├── auth.ts                    # Authentication utilities
│   │   └── razorpay.ts                # Razorpay integration
│   ├── public/                        # Static assets
│   ├── next.config.js                 # Next.js configuration
│   ├── tailwind.config.js             # Tailwind CSS config
│   └── package.json                   # Frontend dependencies
│
├── services/                          # Backend Microservices
│   ├── README.md                      # Backend overview
│   ├── app.py                         # FastAPI entry point
│   ├── entrypoint.sh                  # Docker startup script
│   ├── Dockerfile                     # Backend container image
│   ├── requirements.txt               # Python dependencies
│   ├── .env.example                   # Environment template
│   │
│   └── api/                           # Main FastAPI application
│       ├── README.md                  # API documentation
│       ├── src/                       # Application source code
│       │   ├── app.py                 # FastAPI app factory
│       │   ├── routes/                # API endpoint handlers
│       │   │   ├── auth.py            # Auth & OAuth
│       │   │   ├── github.py          # GitHub integration
│       │   │   ├── review.py          # Code review endpoints
│       │   │   ├── jobs.py            # Job search API
│       │   │   ├── resume.py          # Resume operations
│       │   │   └── subscription.py    # Razorpay subscriptions
│       │   ├── services/              # Business logic
│       │   │   ├── ai_service.py      # Review orchestration
│       │   │   ├── analysis_engine.py # CodeBERT analysis
│       │   │   ├── github_service.py  # GitHub API client
│       │   │   ├── resume_service.py  # Resume parsing
│       │   │   └── razorpay_service.py  # Payment processing
│       │   ├── middleware/            # Auth & rate limiting
│       │   ├── configs/               # Pydantic settings
│       │   ├── schemas/               # Request/response models
│       │   ├── utils/                 # Helper functions
│       │   └── models/                # ML model wrappers
│       │
│       ├── crawler/                   # Job Scraper (9+ sites)
│       │   ├── README.md              # Crawler documentation
│       │   ├── src/
│       │   │   ├── index.py           # Main crawler orchestrator
│       │   │   ├── config.py          # Configuration
│       │   │   ├── utils.py           # Database & utilities
│       │   │   ├── scrapers/          # Platform-specific scrapers
│       │   │   │   ├── base.py        # Base scraper class
│       │   │   │   ├── linkedin.py    # LinkedIn Jobs
│       │   │   │   ├── indeed.py      # Indeed
│       │   │   │   ├── naukri.py      # Naukri (India)
│       │   │   │   ├── internshala.py # Internshala
│       │   │   │   ├── wellfound.py   # Wellfound (Startups)
│       │   │   │   ├── unstop.py      # Unstop
│       │   │   │   ├── glassdoor.py   # Glassdoor
│       │   │   │   └── cutshort.py    # Cutshort
│       │   │   └── processors/
│       │   │       └── normalize.py   # Data normalization
│       │   └── requirements.txt
│       │
│       ├── neural_generator/         # Local LLM Service
│       │   ├── README.md              # Generator documentation
│       │   ├── src/
│       │   │   └── app.py             # FastAPI microservice
│       │   ├── models/                # Qwen GGUF model (400MB)
│       │   ├── requirements.txt
│       │   └── Dockerfile
│       │
│       └── rag/                       # Semantic Search (RAG)
│           ├── README.md              # RAG documentation
│           ├── src/
│           │   ├── app.py             # FastAPI microservice
│           │   ├── services/
│           │   │   ├── indexer.py     # Repository indexing
│           │   │   ├── vector_store.py# FAISS management
│           │   │   ├── embedder.py    # Sentence-transformers
│           │   │   └── generator.py   # LLM integration
│           │   └── schemas/
│           ├── indices/               # FAISS indices (persisted)
│           ├── requirements.txt
│           └── Dockerfile
│
├── database/                          # Database Layer
│   └── migrations/
│       ├── 001_users.sql              # User accounts & GitHub tokens
│       ├── 002_resumes.sql            # User resumes
│       ├── 003_jobs.sql               # Scraped job listings
│       ├── 004_subscriptions.sql      # Razorpay subscription data
│       └── 005_repo_docs.sql          # Repository documentation
│
├── infrastructure/                    # Deployment
│   └── docker/
│       ├── docker-compose.yml         # Local development
│       └── docker-compose.prod.yml    # Production with replicas
│
├── tests/                             # Test Suite
│   ├── test_api.py                    # API endpoint integration tests
│   ├── test_analysis.py               # Code analysis unit tests
│   ├── test_ml.py                     # Model loading & inference
│   ├── test_performance.py            # Benchmark tests
│   ├── test_resume_ai.py              # Resume processing tests
│   ├── test_self_healing.py           # Auto-fix pipeline tests
│   └── validate_system.py             # System validation
│
└── logs/                              # Runtime logs
    └── (rotated log files)
```
## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14, TypeScript, Tailwind CSS | Modern SPA with SSR |
| **Backend** | FastAPI, Python 3.11+ | High-performance async API |
| **Microservices** | FastAPI × 3 (Crawler, RAG, Neural Generator) | Scalable service architecture |
| **Database** | PostgreSQL 12+ | Primary data store |
| **Cache** | Redis (optional) | Session & review caching |
| **Vector DB** | FAISS | Semantic search & embeddings |
| **ML/NLP** | HuggingFace Transformers, sentence-transformers | Code analysis & text generation |
| **Browser Automation** | Playwright | Job scraping automation |
| **LLM Inference** | llama-cpp-python (GGUF) | Local, quantized model |
| **Payments** | Stripe | Subscription management |
| **Auth** | JWT + OAuth 2.0 + Fernet | Secure token management |
| **Async** | asyncio, httpx | Concurrent request handling |
| **Containers** | Docker, Docker Compose | Deployment & orchestration |

## System Architecture

```
┌───────────────────────────────────────────┐
│   Frontend (Next.js)                      │
│   - Auth UI                               │
│   - Job Search & Matching                 │
│   - Resume Analyzer                       │
│   - GitHub Browser & Terminal             │
└──────────────┬──────────────────────────┘
               │ HTTP/WebSocket
┌──────────────▼──────────────────────────┐
│   API Gateway (FastAPI)                  │
│   - Route multiplexing                   │
│   - Rate limiting (100-500 req/min)     │
│   - JWT middleware                       │
└──────────────┬──────────────────────────┘
       ┌───────┼───────┐
       │       │       │
   ┌───▼──┐ ┌─▼────┐ ┌▼───────────┐
   │ Auth │ │ Jobs │ │ Reviews    │
   ├──────┤ ├──────┤ ├────────────┤
   │OAuth │ │Crawler│ │CodeBERT   │
   │JWT   │ │ RAG  │ │Auto-fix   │
   │      │ │      │ │           │
   └──────┘ └──────┘ └───────────┘
       │       │           │
       └───────┴───────────┴─────┐
                                 │
                    ┌────────────▼────────────┐
                    │ Microservices         │
                    ├──────────────────────┤
                    │ Crawler (Port 8003)  │
                    │ RAG (Port 8002)      │
                    │ Neural Gen (Port 8001)│
                    └────────────┬─────────┘
                                 │
                    ┌────────────▼────────────┐
                    │ PostgreSQL Database    │
                    │ - Users                │
                    │ - Resumes              │
                    │ - Jobs                 │
                    │ - Subscriptions        │
                    │ - Repo Docs            │
                    └────────────────────────┘
```

## Core API Endpoints

### Authentication
- `POST /api/auth/github/login` – GitHub OAuth flow
- `POST /api/auth/logout` – Invalidate JWT token
- `GET /api/auth/me` – Current user profile

### Code Review
- `POST /api/review/submit` – Submit code for analysis
- `GET /api/review/{review_id}` – Get review results
- `POST /api/review/{review_id}/autofix` – Generate fixes

### Job Listings  
- `GET /api/jobs/search?query=internship&location=Bangalore` – Search jobs
- `GET /api/jobs/{job_id}` – Job details
- `POST /api/jobs/match` – AI matching with resume

### Resume Processing
- `POST /api/resume/upload` – Upload & parse resume
- `GET /api/resume/{resume_id}` – Get parsed resume
- `POST /api/resume/{resume_id}/analyze` – AI analysis

### GitHub Integration
- `GET /api/github/repos` – List user repositories
- `GET /api/github/{repo}/files` – Browse repo files
- `POST /api/github/{repo}/auto-setup` – Generate README

### Subscriptions
- `POST /api/subscription/checkout` – Create Stripe session
- `GET /api/subscription/status` – Check subscription tier
- `POST /api/webhook/stripe` – Payment webhook

**Full API documentation:** Visit http://localhost:8000/docs (Swagger UI)

## Testing

```bash
# Navigate to repo root
cd RepoSense

# Run all tests
pytest -v

# Run specific test suite
pytest tests/test_api.py                    # API integration
pytest tests/test_analysis.py               # Code analysis
pytest tests/test_ml.py                     # Model inference
pytest tests/test_performance.py            # Benchmarks
pytest tests/test_resume_ai.py              # Resume parsing

# Run with coverage
pytest --cov=services tests/

# Test individual service
pytest tests/test_imports.py                # Validate imports
python services/api/test_imports.py         # API validation
```

## Deployment

### Local Development
```bash
make install     # Install all dependencies
make dev         # Start all services
make test        # Run test suite
```

### Docker (Recommended)
```bash
# Development
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Production
docker-compose -f infrastructure/docker/docker-compose.prod.yml up -d
```

### Railway.app (One-Click Deploy)
```bash
# First time setup
railway init
railway add postgres
railway up

# View logs
railway logs
```

### Manual Deployment (AWS/Azure/DigitalOcean)
See [DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for detailed platform-specific instructions.

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Main project overview (this file) |
| [OVERVIEW.md](./OVERVIEW.md) | Executive summary & architecture |
| [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) | Step-by-step setup instructions |
| [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) | Production deployment guide |
| [docs/SETUP_COMPLETE.md](./docs/SETUP_COMPLETE.md) | Model configuration |
| [apps/web/README.md](./apps/web/README.md) | Frontend-specific documentation |
| [services/README.md](./services/README.md) | Backend microservices guide |
| [services/api/README.md](./services/api/README.md) | Main API service documentation |
| [services/api/crawler/README.md](./services/api/crawler/README.md) | Job crawler guide |
| [services/api/neural_generator/README.md](./services/api/neural_generator/README.md) | LLM generator guide |
| [services/api/rag/README.md](./services/api/rag/README.md) | RAG service documentation |

## Contributing

We welcome contributions! Please:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Workflow
- Follow PEP 8 for Python code
- Use TypeScript strict mode for frontend
- Write tests for new features
- Update documentation in README files

## License

This project is licensed under the **MIT License** – see [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Documentation**: See `/docs` folder
- **Setup Help**: See [SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)

---

** Ready to get started?** Run `python scripts/setup_models.py` and then `python services/app.py`!
