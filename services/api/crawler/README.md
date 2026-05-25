# Job Aggregator Crawler

> Automated multi-platform job scraper for 9+ job boards. Fetches job postings, normalizes data, deduplicates, and stores in PostgreSQL for unified job search across LinkedIn, Indeed, Naukri, Internshala, Wellfound, Unstop, Glassdoor, Cutshort, and company portals.

## Overview

The RepoSense Crawler is a high-performance, asynchronous job scraper that:
- **Scrapes 9+ job boards** simultaneously using Playwright browser automation
- **Handles dynamic JavaScript-heavy sites** with headless Chrome/Firefox
- **Normalizes data** into consistent schema across all platforms
- **Deduplicates** jobs to avoid storing the same posting twice
- **Enriches job data** with company info, tags, and categorization
- **Stores in PostgreSQL** for unified job search and matching
- **Includes retry logic** with exponential backoff for reliability
- **Supports proxy rotation** and user-agent randomization for stealth

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Browser Automation** | Playwright | Headless browser control |
| **HTML Parsing** | BeautifulSoup | DOM parsing & CSS selectors |
| **HTTP** | httpx | Async HTTP client |
| **Async** | asyncio | Concurrent scraping |
| **Database** | PostgreSQL (asyncpg) | Job storage |
| **Configuration** | Python Dotenv | Environment settings |
| **Logging** | structlog | Structured logging |

## Quick Start

### Prerequisites

```bash
- Python 3.10+
- PostgreSQL 12+ (running)
- 500MB free disk space (cache & logs)
- Internet connection
```

### Installation

```bash
# Navigate to crawler directory
cd services/api/crawler

# Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# OR
venv\Scripts\activate              # Windows

# Install dependencies
pip install -r requirements.txt

# Download Playwright browsers (required once)
playwright install

# Create .env file
cat > .env << EOF
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=internship_db

# Scraping Settings
SCRAPER_DEBUG=false               # Enable HTML debug capture
MAX_WORKERS=4                     # Parallel scrapers
REQUEST_TIMEOUT=30                # Seconds per request
HEADLESS=true                     # Run browsers in headless mode

# Optional
PROXY_LIST=http://proxy1:8080,http://proxy2:8080
PROXY_ROTATION=true
USER_AGENT_ROTATION=true
EOF

# Run the crawler
python src/index.py
```

**Crawler running at:** http://localhost:8003 (if running as microservice)

## Project Structure

```
services/api/crawler/
├── README.md                          # This file
├── requirements.txt                   # Python dependencies
├── Dockerfile                         # Container image
├── .env.example                       # Environment template
│
├── src/
│   ├── index.py                       # Main orchestrator
│   ├── config.py                      # Configuration settings
│   ├── utils.py                       # Database & utilities
│   │
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── base.py                    # Base scraper class
│   │   ├── linkedin.py                # LinkedIn Jobs
│   │   ├── indeed.py                  # Indeed
│   │   ├── naukri.py                  # Naukri (India)
│   │   ├── internshala.py             # Internshala (India)
│   │   ├── wellfound.py               # Wellfound (Startups)
│   │   ├── unstop.py                  # Unstop (India)
│   │   ├── glassdoor.py               # Glassdoor
│   │   ├── cutshort.py                # Cutshort (India)
│   │   └── company_portals.py         # Company sites (Wipro, TCS, etc)
│   │
│   └── processors/
│       ├── __init__.py
│       ├── normalize.py               # Data standardization
│       └── dedup.py                   # Duplicate removal
│
└── debug/
    └── (HTML snapshots - only when SCRAPER_DEBUG=true)
```
```

### Running the Crawler

```bash
# Default: All scrapers, 5 pages each
cd src && python index.py

# Custom: Specific scrapers
python index.py --scrapers linkedin indeed --max-pages 10

# Dry-run (no DB saves)
python index.py --dry-run

# With debug HTML capture
export SCRAPER_DEBUG=true
python index.py --scrapers linkedin --max-pages 1
```

## Supported Job Sites

| Site | Scraper | Support | Auth | Notes |
|------|---------|---------|------|-------|
| LinkedIn | `linkedin.py` | Full | None | JavaScript heavy |
| Indeed | `indeed.py` | Full | None | Pagination support |
| Naukri | `naukri.py` | Full | None | India-focused |
| Internshala | `internshala.py` | Jobs + Internships | None | Student platform |
| Wellfound | `wellfound.py` | Full | None | Startup jobs |
| Unstop | `unstop.py` | Jobs + Competitions | None | Campus recruitment |
| Glassdoor | `glassdoor.py` | Full | None | Company reviews included |
| Cutshort | `cutshort.py` | Full | None | Tech-focused |
| Company Portals | `company_portals.py` | Multiple | None | Wipro, TCS, Infosys, etc |

## Pipeline Flow

```
Start
  ↓
1. INITIALIZE
  ├─ Connect to PostgreSQL
  ├─ Load configuration
  └─ Initialize browser context
  ↓
2. LOOP FOR EACH SCRAPER
  ├─ Create scraper instance
  ├─ Navigate to site
  ├─ Parse job listings
  ├─ Extract fields (title, company, url, etc)
  ├─ Normalize data
  └─ Deduplicate (by URL)
  ↓
3. STORE IN DB
  ├─ INSERT OR UPDATE jobs
  ├─ Set posted_at timestamp
  └─ Track source
  ↓
4. RETRY ON FAILURE
  ├─ Exponential backoff
  ├─ Max retries: 3
  └─ Continue on error
  ↓
5. LOGGING & SUMMARY
  ├─ Total jobs: XXX
  ├─ New jobs: YYY
  ├─ Errors: ZZZ
  └─ Duration: HHH
  ↓
End
```

##  Data Schema

### jobs Table

```sql
CREATE TABLE jobs (
  id              VARCHAR PRIMARY KEY,
  title           VARCHAR NOT NULL,
  company         VARCHAR NOT NULL,
  description     TEXT,
  url             VARCHAR UNIQUE,
  source          VARCHAR,              -- linkedin, indeed, naukri, etc
  posted_at       TIMESTAMP,             -- When job was posted
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

**Fields Extracted:**

| Field | Type | Example |
|-------|------|---------|
| `id` | UUID | `indeed_job_123` |
| `title` | String | `Senior Python Developer` |
| `company` | String | `Google` |
| `description` | Text | Job description (HTML stripped) |
| `url` | String | Full job URL |
| `source` | String | `linkedin`, `indeed`, etc |
| `posted_at` | DateTime | Relative: `2 days ago` → parsed |

##  Command-Line Options

```bash
python index.py [OPTIONS]

Options:
  --scrapers [linkedin|indeed|naukri|...]    # Specific scrapers
  --max-pages INTEGER                        # Max pages per scraper (default: 5)
  --dry-run                                  # No database saves
  --help                                     # Show help
```

### Examples

```bash
# Scrape LinkedIn only, 10 pages
python index.py --scrapers linkedin --max-pages 10

# Dry-run all scrapers
python index.py --dry-run

# Multiple scrapers
python index.py --scrapers linkedin indeed naukri --max-pages 3

# Debug mode (saves HTML)
SCRAPER_DEBUG=true python index.py --scrapers linkedin --max-pages 1
```

##  Environment Variables

### Required (with defaults)

```bash
PG_HOST=postgres                   # PostgreSQL host
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=internship_db
```

### Optional

```bash
SCRAPER_DEBUG=false                # Save HTML snapshots
MAX_WORKERS=3                      # Parallel workers
REQUEST_TIMEOUT=30                 # Seconds
HEADLESS=true                      # Run browser headless
PROXY_LIST=proxy1.com|proxy2.com   # Pipe-separated proxies
```

##  Performance

### Scraping Speed

```
Per page: 5-15 seconds (depends on site)
Concurrent scrapers: 3 (default)
Total for all 9 sites, 5 pages each: ~5-10 minutes
```

### Database Performance

```
Insert 1000 jobs: ~2 seconds
Upsert (dedup): ~3 seconds (ON CONFLICT)
Full scan: <1 second
```

### Memory Usage

```
Base: ~50MB
Per browser instance: ~150MB
Total (3 parallel): ~500MB
```



## Configuration Reference

### Basic Configuration

```bash
# .env file
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=internship_db
```

### Advanced Options

```bash
# Scraping Settings
SCRAPER_DEBUG=false               # Capture HTML for debugging
MAX_WORKERS=4                     # Number of parallel scrapers
REQUEST_TIMEOUT=30                # Seconds to wait per request
HEADLESS=true                     # Run browser in headless mode
VERIFY_SSL=true                   # Verify HTTPS certificates

# Retry & Resilience
MAX_RETRIES=3                     # Retries per scraper
RETRY_BACKOFF=2                   # Exponential backoff multiplier
CONNECTION_POOL_SIZE=5            # PostgreSQL connections

# Proxy & Stealth (Optional)
PROXY_LIST=http://proxy1:8080;http://proxy2:8080
PROXY_ROTATION=true
USER_AGENT_ROTATION=true
RANDOM_DELAY_MIN=1                # Min delay between requests (sec)
RANDOM_DELAY_MAX=5                # Max delay between requests (sec)
```

## Supported Sites & Details

### 1. LinkedIn (`linkedin.py`)
- **URL**: https://www.linkedin.com/jobs/search/
- **Features**: Rich job descriptions, company info, skills tags
- **Rate Limit**: Slow (JavaScript heavy)
- **Auth**: Not required

### 2. Indeed (`indeed.py`)
- **URL**: https://www.indeed.com/jobs/
- **Features**: Large job database, salary info
- **Rate Limit**: Fast, paginated
- **Auth**: Not required

### 3. Naukri (`naukri.py`)
- **URL**: https://www.naukri.com/
- **Features**: India-focused, salary expectations
- **Rate Limit**: Moderate
- **Auth**: Not required (site specific)

### 4. Internshala (`internshala.py`)
- **URL**: https://internshala.com/jobs/
- **Features**: Student internships + jobs
- **Rate Limit**: Moderate
- **Auth**: Not required

### 5. Wellfound (`wellfound.py`)
- **URL**: https://wellfound.com/jobs
- **Features**: Startup jobs, equity info
- **Rate Limit**: Moderate
- **Auth**: Not required

### 6. Unstop (`unstop.py`)
- **URL**: https://www.unstop.com/
- **Features**: Campus recruitment, competitions
- **Rate Limit**: Moderate
- **Auth**: Not required

### 7. Glassdoor (`glassdoor.py`)
- **URL**: https://www.glassdoor.com/Job/jobs.htm
- **Features**: Company reviews, salary data
- **Rate Limit**: Fast
- **Auth**: Not required

### 8. Cutshort (`cutshort.py`)
- **URL**: https://cutshort.io/tech-jobs
- **Features**: Tech-focused, India-centric
- **Rate Limit**: Fast
- **Auth**: Not required

### 9. Company Portals (`company_portals.py`)
- **Companies**: Wipro, TCS, Infosys, Accenture, Deloitte, etc
- **Features**: Direct company career pages
- **Rate Limit**: Varies
- **Auth**: Not required

## Data Extraction

All jobs are normalized to this schema:

```json
{
  "id": "linkedin_job_123456",
  "title": "Senior Python Developer",
  "company": "Google",
  "location": "Bangalore, India",
  "description": "We are looking for...",
  "salary_min": 50000,
  "salary_max": 120000,
  "currency": "INR",
  "job_type": "Full-time",
  "experience_level": "Senior",
  "skills": ["Python", "FastAPI", "PostgreSQL"],
  "url": "https://...",
  "source": "linkedin",
  "posted_at": "2024-01-15T00:00:00Z"
}
```

## Running the Crawler

### Default Run (All Sites)

```bash
cd services/api/crawler/src
python index.py
```

**Output:**
```
[2024-01-15 10:30:00] Starting job crawl...
[2024-01-15 10:30:05] LinkedIn scraper started...
[2024-01-15 10:32:10] LinkedIn: Fetched 125 jobs
[2024-01-15 10:32:15] Indeed scraper started...
[2024-01-15 10:34:20] Indeed: Fetched 98 jobs
...
[2024-01-15 10:50:00] Crawl complete!
  ├─ Total jobs: 892
  ├─ New jobs: 456
  ├─ Duplicates skipped: 436
  ├─ Errors: 2
  └─ Duration: 20 minutes
```

### Custom Scraping

```bash
# LinkedIn only, 10 pages
python index.py --scrapers linkedin --max-pages 10

# Multiple sites
python index.py --scrapers linkedin indeed naukri --max-pages 5

# Dry-run (no database writes)
python index.py --dry-run

# Debug mode (saves HTML)
SCRAPER_DEBUG=true python index.py --scrapers linkedin --max-pages 1
```

### Scheduled Runs (Cron)

```bash
# Run daily at 2 AM
0 2 * * * cd /repo/services/api/crawler && python src/index.py >> /var/log/crawler.log 2>&1

# Run every 6 hours
0 */6 * * * cd /repo/services/api/crawler && python src/index.py
```

## Docker Usage

### Build Image

```bash
cd services/api/crawler
docker build -t repo-sense-crawler:latest .
```

### Run Container

```bash
docker run -d \
  --name crawler \
  -e PG_HOST=postgres \
  -e PG_USER=postgres \
  -e PG_PASSWORD=postgres \
  -e PG_DB=internship_db \
  --network repo-sense-net \
  repo-sense-crawler:latest
```

### With Docker Compose

```yaml
crawler:
  build: ./services/api/crawler
  environment:
    PG_HOST: postgres
    PG_USER: postgres
    PG_PASSWORD: postgres
    PG_DB: internship_db
    MAX_WORKERS: 4
  depends_on:
    - postgres
  volumes:
    - ./logs:/app/logs
```

## Testing

```bash
# Test imports
python -c "from src.scrapers import linkedin, indeed; print('✓ Imports OK')"

# Dry-run (no DB)
python src/index.py --dry-run

# Single page test
python src/index.py --scrapers linkedin --max-pages 1 --dry-run

# Verify database connection
python -c "import asyncio; from src.utils import get_db; asyncio.run(get_db())"
```

## Troubleshooting

### Issue 1: "ConnectionRefusedError: PostgreSQL not running"

**Solution:**
```bash
# Start PostgreSQL (Linux/Mac)
brew services start postgresql

# Or Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15

# Verify
psql -U postgres -c "SELECT 1"
```

### Issue 2: "Timeout waiting for browser launch"

**Solution:**
```bash
# Install Playwright browsers
playwright install

# Or manually
playwright install chromium firefox
```

### Issue 3: "Blocked: Too many requests (429)"

**Solution:**
```bash
# Increase delays and reduce workers
MAX_WORKERS=2
RANDOM_DELAY_MIN=3
RANDOM_DELAY_MAX=10

# Or use proxy rotation
PROXY_ROTATION=true
PROXY_LIST=http://proxy1:8080;http://proxy2:8080
```

### Issue 4: "jobs table does not exist"

**Solution:**
```bash
# Run migrations
cd ../..
python run_migrations.py

# Verify
psql -U postgres internship_db -c "\dt"
```

### Issue 5: "HTMLParseError or selector not found"

**Enable debug mode:**
```bash
SCRAPER_DEBUG=true python src/index.py --scrapers linkedin --max-pages 1

# Check HTML snapshots in debug/
ls debug/
```

## Performance Optimization

### Scale Up Scraping

```bash
# Increase parallel workers
MAX_WORKERS=8

# Reduce delays
RANDOM_DELAY_MIN=0.5
RANDOM_DELAY_MAX=2

# Run multiple instances
# Instance 1: python index.py --scrapers linkedin indeed naukri
# Instance 2: python index.py --scrapers internshala wellfound unstop
# Instance 3: python index.py --scrapers glassdoor cutshort company_portals
```

### Database Optimization

```sql
-- Add index on source for faster filtering
CREATE INDEX idx_jobs_source ON jobs(source);

-- Add index on posted_at for sorting
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);

-- Add index on url for deduplication
CREATE INDEX idx_jobs_url ON jobs(url);

-- Analyze table for query optimization
ANALYZE jobs;
```

## Development

### Adding a New Scraper

```python
# src/scrapers/example_site.py
from .base import BaseScraper

class ExampleSiteScraper(BaseScraper):
    BASE_URL = "https://example-site.com"
    
    async def parse_jobs(self, page_num: int):
        """Parse jobs from page_num."""
        url = f"{self.BASE_URL}/jobs?page={page_num}"
        
        # Navigate and parse
        jobs = []
        for job_elem in await self.get_elements(".job-card"):
            job = {
                "id": await job_elem.get_attribute("data-id"),
                "title": await self.get_text(".title", job_elem),
                "company": await self.get_text(".company", job_elem),
                # ... more fields
            }
            jobs.append(job)
        
        return jobs
```

## Related Services

- **Main API:** [services/api/README.md](../README.md)
- **Database:** [Database Migrations](../../database/migrations/)
- **Backend:** [services/README.md](../../README.md)

---

**For deployment:** See [docs/DEPLOYMENT_GUIDE.md](../../../../docs/DEPLOYMENT_GUIDE.md)
docker build -t job-crawler:latest .
```

### Run

```bash
docker run -d \
  --name job-crawler \
  -e PG_HOST=postgres \
  -e PG_USER=postgres \
  -e PG_PASSWORD=postgres \
  -e PG_DB=internship_db \
  --network internship_network \
  job-crawler:latest
```

### Docker Compose

```yaml
crawler:
  build: ./services/api/crawler
  environment:
    PG_HOST: db
    PG_USER: postgres
    PG_PASSWORD: postgres
    PG_DB: internship_db
    SCRAPER_DEBUG: "false"
  depends_on:
    - db
  networks:
    - internship_network
```

##  Troubleshooting

### Scrapers Timeout

```bash
# Increase timeout
export REQUEST_TIMEOUT=60

# Or reduce parallel workers
export MAX_WORKERS=1
```

### Browser Installation Fails

```bash
# Re-install Playwright browsers
playwright install

# Or specify browser
playwright install chromium
```

### Database Connection Fails

```bash
# Verify PostgreSQL running
psql -U postgres -d internship_db -c "SELECT 1"

# Check connection string
PG_HOST=localhost PG_PORT=5432 PG_USER=postgres PG_DB=internship_db
```

### Missing Jobs Data

```bash
# Check database for jobs
psql -c "SELECT COUNT(*) FROM jobs"

# Enable debug mode
export SCRAPER_DEBUG=true
python index.py --scrapers linkedin --max-pages 1
ls -la debug/

# Check logs
cat crawler.log
```

### High Memory Usage

```bash
# Reduce parallel workers
export MAX_WORKERS=1

# Or reduce pages
python index.py --max-pages 2
```

##  Monitoring

### Job Count by Source

```sql
SELECT source, COUNT(*) as count FROM jobs GROUP BY source;
```

### Recent Jobs

```sql
SELECT title, company, source, posted_at 
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Scraper Runtime

```bash
# Check logs
tail -f crawler.log

# Duration: grep for "Total time"
```

##  Scheduling

### Cron Job (Linux)

```bash
# Run daily at 2 AM
0 2 * * * cd /opt/repo-sense/services/api/crawler && python src/index.py >> crawler.log 2>&1
```

### Systemd Timer

```bash
sudo tee /etc/systemd/system/crawler.service << EOF
[Unit]
Description=Repo Sense Job Crawler
After=postgresql.service

[Service]
Type=oneshot
User=app
WorkingDirectory=/opt/repo-sense/services/api/crawler
ExecStart=/usr/bin/python3 src/index.py
EOF

sudo tee /etc/systemd/system/crawler.timer << EOF
[Unit]
Description=Run Job Crawler Daily
Requires=crawler.service

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl enable crawler.timer
sudo systemctl start crawler.timer
```

### Docker Cron

```bash
docker run -d \
  --name crawler-cron \
  -e PG_HOST=db \
  -e SCHEDULE="0 2 * * *" \
  job-crawler:latest
```

## 📈 Performance Tuning

| Issue | Solution |
|-------|----------|
| Slow scraping | Increase `MAX_WORKERS`, reduce `max-pages` |
| High memory | Reduce `MAX_WORKERS`, run one scraper at a time |
| Database full | Clean old jobs: `DELETE FROM jobs WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 MONTH)` |
| Missing data | Check SCRAPER_DEBUG=true, inspect HTML |

##  Related Services

- **Main API**: [services/README.md](../README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](../neural-generator/README.md)
- **RAG Service**: [services/api/rag/README.md](../rag/README.md)

##  Support

1. **Debug mode**: `SCRAPER_DEBUG=true python index.py --scrapers linkedin --max-pages 1`
2. **Check logs**: `tail -f crawler.log`
3. **Verify DB**: `psql -c "SELECT COUNT(*) FROM jobs"`
4. **Browser issues**: `playwright install`

##  License

Part of Repo Sense project