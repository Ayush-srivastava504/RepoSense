# RepoSense (InternFlow) — Intelligent Career & Developer Platform

RepoSense (internally hosted as **InternFlow**) is an open-source, AI-powered developer career platform designed to help students, early-career engineers, and tech professionals land high-paying software jobs, remote roles, and internships. 

It combines real-time multi-board job scraping, ATS resume optimization, AI code reviews, LaTeX resume compilation, a GitHub-connected terminal, an automated LeetCode judge, and a multilingual, internationalized SEO engine.

---

## 🌟 Key Highlights & Feature Matrix

- **Global Job & Internship Feed**: Crawls dozens of job boards (Indeed, LinkedIn, Greenhouse, Lever, Ashby, Y Combinator, Sarkari Naukri) daily, normalizing locations, compensation, and required skill ontologies.
- **Multilingual International SEO (i18n)**: Fully localized in **9 languages** (English, Español, 日本語, Français, Deutsch, Português, 한국어, Italiano, हिन्दी) with dynamic routing, hreflang alternate headers, structured Schema.org breadcrumbs, and localized sitemaps.
- **AI-Powered ATS Resume Builder**: Contextual resume scoring that reverse-engineers parsing algorithms, aligns bullet points with target job descriptions, and compiles pixel-perfect PDF resumes using LaTeX.
- **Automated AI GitHub Code Review**: Connects to public/private GitHub repositories, analyzes code architecture and commit hygiene, and drafts portfolio-ready bullet points.
- **Interactive Developer Terminal**: In-browser xterm.js terminal with OAuth session management, command execution, and direct GitHub repo sync.
- **LeetCode Practice Judge**: Automated code evaluation, Blind 75 tracker integration, and company-specific coding challenge breakdowns.
- **Application Tracker**: Kanban-style job tracking board with deadlines, interview rounds, follow-up reminders, and local storage / DB synchronization.

---

## 🏗️ Architecture & Monorepo Layout

```
Repo_Sense/
├── apps/
│   └── web/                   # Next.js 14 App Router, TypeScript, Tailwind CSS, i18n
│       ├── app/               # Routes (jobs, internships, blog, auth, tools, tracker)
│       ├── components/        # Reusable UI components & LanguageSwitcher
│       ├── content/           # Multilingual blog posts (JSON) and SEO keywords queue
│       ├── i18n/              # 9 language dictionaries, loader & config
│       └── lib/               # API client, auth hooks, blog data loaders, structured schemas
├── services/
│   ├── api/                   # Core FastAPI backend (port 8000)
│   │   ├── src/               # Auth, jobs, resume compiler, ATS checker, LeetCode judge
│   │   ├── crawler/           # Automated scrapers for external career portals
│   │   ├── rag/               # RAG Q&A service with vector search (port 8001)
│   │   ├── neural_generator/  # Local LLM text generation via llama.cpp (port 8002)
│   │   ├── loadtest/          # k6 load testing suites
│   │   └── database/          # PostgreSQL migrations (001 to 018)
├── infrastructure/
│   └── docker/                # Docker compose orchestration (Postgres, Redis, APIs, Web)
├── scripts/                   # Daily SEO generation, DB migrations, content enrichment
└── docs/                      # Architectural setup, deployment, and model migration guides
```

---

## 🌐 Public SEO & Programmatic Surface

The web app serves statically generated and dynamically cached public hubs engineered for international search ranking:

| Route | Functionality | Data Source |
| :--- | :--- | :--- |
| `/jobs` & `/internships` | Paginated live job listings with faceted search | `lib/jobs.ts` |
| `/remote-jobs` & `/government-jobs` | Category-specific listings & regional filters | `getJobs({ category })` |
| `/japan-jobs` & `/europe-jobs` | Country-specific listings with visa tags | `getJobs({ country })` |
| `/jobs-in/[city]` | Indian & global tech city hub pages (Bangalore, Pune, Delhi NCR, etc.) | `app/jobs-in/data.ts` |
| `/skills/[skill]` | 24+ skill hub pages (Python, React, AWS, Docker, PyTorch) | `app/skills/data.ts` |
| `/careers/[role]` | Deep career path blueprints & recommended tech stacks | `app/careers/data.ts` |
| `/resume-for/[role]` | Role-specific ATS resume templates, bullet examples & keywords | `app/resume-for/data.ts` |
| `/tools` | Suite of free AI tools (Resume Builder, ATS Checker, Cover Letter) | `app/tools/data.ts` |
| `/blog` & `/blog/[slug]` | High-intent engineering & career blog guides | `content/blog/*.json` |
| `/[locale]/blog/[slug]` | Localized blog versions in **es, ja, fr, de, pt, ko, it, hi** | `content/blog/[locale]/*.json` |

---

## 🚀 Quick Start & Local Development

### Prerequisites
- Node.js 18+ & npm / pnpm
- Python 3.10+
- Docker & Docker Compose (optional, for full containerized stack)
- PostgreSQL & Redis

### 1. Starting the Entire Stack with Docker

```bash
# Clone the repository
git clone https://github.com/Ayush-srivastava504/RepoSense.git
cd RepoSense

# Start PostgreSQL, Redis, FastAPI, RAG, and Web services
make build
make dev
```

### 2. Manual Local Development

#### Frontend (`apps/web`):
```bash
cd apps/web
npm install
npm run dev
# Server running at http://localhost:3000
```

#### Core Backend (`services/api`):
```bash
cd services/api
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Unix:
source venv/bin/activate

pip install -r requirements.txt
uvicorn src.app:app --reload --port 8000
```

---

## 🛠️ Environment Configuration

Create a `.env` file at the root or under `services/api/` and `apps/web/`:

### Frontend (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_LOGO_DEV_TOKEN=your_logo_dev_token
```

### Backend (`services/api/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reposense
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=super_secret_jwt_key_here
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
ANTHROPIC_API_KEY=optional_claude_api_key
GROQ_API_KEY=optional_groq_api_key
```

---

## 🧪 Testing & Code Quality

```bash
# Run backend pytest suite
make test

# Run k6 API load test
cd services/api/loadtest
k6 run loadtest.js
```

---

## 📄 License & Attribution

Built for students, early-career developers, and tech job seekers worldwide. Distributed under the MIT License.
