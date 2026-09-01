# RepoSense Backend Microservices (`services/`)

The backend layer of RepoSense consists of high-performance Python services built on **FastAPI**, distributed background workers, scrapers, and localized ML/LLM microservices.

---

## 🏛️ Service Ecosystem & Ports

```
services/
├── api/                   # Core REST API (port 8000)
│   ├── src/               # Application logic, route handlers, auth, DB models
│   ├── crawler/           # Multi-threaded job and hackathon scraper
│   ├── rag/               # Retrieval-Augmented Generation service (port 8001)
│   ├── neural_generator/  # Local LLM text generator via llama.cpp (port 8002)
│   ├── loadtest/          # k6 load testing suite
│   └── database/          # PostgreSQL schema migrations (001 to 018)
└── app.py                 # Root convenience runner for development
```

| Service | Technology | Port | Description |
| :--- | :--- | :--- | :--- |
| **Core API** | FastAPI, SQLAlchemy, Redis | `8000` | User auth, job listings, ATS scoring, LaTeX resume compilation, LeetCode judge |
| **RAG Service** | FastAPI, ChromaDB / FAISS | `8001` | Semantic search and contextual Q&A over career & tech documentation |
| **Neural Generator** | FastAPI, llama.cpp | `8002` | Local offline LLM inference for code reviews and resume bullet drafting |
| **Crawler** | Python, BeautifulSoup, httpx | Background | Scrapes 20+ company career portals and job aggregators daily |

---

## 🚀 Getting Started

### 1. Virtual Environment & Dependencies
```bash
cd services/api
python -m venv venv

# Activate Virtual Environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Database Setup & Migrations
Ensure PostgreSQL and Redis are running:
```bash
# Apply SQL migrations sequentially
python run_migrations.py
```

### 3. Running Core API
```bash
uvicorn src.app:app --reload --port 8000
```
Interactive Swagger documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## 🔍 Microservices Overview

### 1. Core API (`services/api/src`)
- **Authentication**: JWT token issuance, email OTP verification, guest session provisioning.
- **GitHub Integration**: OAuth flow, repository tree inspection, token encryption, and terminal credentials.
- **Resume & ATS Engine**: Regex and vector similarity scoring against job descriptions, LaTeX compilation to PDF.
- **LeetCode Engine**: Test case evaluation, submission history, and Blind 75 tracker progress.

### 2. Web Scraper (`services/api/crawler`)
- Automated collectors targeting career boards and job aggregators.
- Built-in deduplication, location parsing, and salary normalization.
- Content enrichment pipeline (`content_enrichment.py`) to prevent thin content.

### 3. RAG & Vector Search (`services/api/rag`)
- Embeds technical documentation and interview guides into a vector index.
- Provides semantic context injection for intelligent user Q&A.

### 4. Neural Text Generator (`services/api/neural_generator`)
- Self-hosted LLM runtime using quantized GGUF models.
- Generates high-impact resume action bullets without external API costs or data leaks.
