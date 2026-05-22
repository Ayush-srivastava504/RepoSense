# 🕷️ Job Aggregator Crawler

Automated web scraper for job postings from 9+ platforms. Fetches job data from LinkedIn, Indeed, Naukri, Internshala, Wellfound, Unstop, Glassdoor, Cutshort, and company portals. Normalizes data and stores in PostgreSQL for unified job search.

## 🎯 Features

- **Multi-Platform Scraping**: 9+ job sites with platform-specific parsers
- **Stealth Mode**: Proxy rotation, user-agent randomization, rate limiting
- **Playwright Automation**: Handle dynamic JavaScript-heavy sites
- **Data Normalization**: Consistent schema across all platforms
- **Deduplication**: Avoid storing duplicate jobs
- **Intelligent Retry**: Exponential backoff, timeout handling
- **Debug Mode**: Capture HTML snapshots for troubleshooting
- **PostgreSQL Storage**: Unified database, not AWS (DynamoDB/S3)

## 🛠️ Tech Stack

- **Browser Automation**: Playwright (headless Chrome/Firefox)
- **HTML Parsing**: BeautifulSoup
- **HTTP Client**: httpx (async)
- **Database**: PostgreSQL (asyncpg)
- **Concurrency**: asyncio, ThreadPoolExecutor

## 📂 Project Structure

```
services/api/crawler/
├── src/
│   ├── index.py                    # Main pipeline orchestrator
│   ├── utils.py                    # DB, S3 client, utilities
│   ├── config.py                   # Configuration
│   ├── scrapers/
│   │   ├── __init__.py
│   │   ├── linkedin.py             # LinkedIn Jobs scraper
│   │   ├── indeed.py               # Indeed scraper
│   │   ├── naukri.py               # Naukri scraper
│   │   ├── internshala.py          # Internshala (jobs & internships)
│   │   ├── wellfound.py            # Wellfound scraper
│   │   ├── unstop.py               # Unstop (jobs & competitions)
│   │   ├── glassdoor.py            # Glassdoor scraper
│   │   ├── cutshort.py             # Cutshort scraper
│   │   ├── company_portals.py      # Wipro, TCS, Infosys, etc
│   │   └── base.py                 # Base scraper class
│   ├── processors/
│   │   ├── __init__.py
│   │   └── normalize.py            # Data normalization
│   └── templates/
│       └── ...                     # CSS selectors, XPath
├── requirements.txt
├── Dockerfile
├── README.md                       # This file
└── debug/
    └── (HTML snapshots)            # Only in SCRAPER_DEBUG mode
```

## 🚀 Quick Start

### Prerequisites

```bash
- Python 3.10+
- PostgreSQL (running)
- 500MB free space (logs, cache)
- 2GB RAM minimum
```

### Installation

```bash
# Navigate to crawler
cd services/api/crawler

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Download Playwright browsers
playwright install
```

### Configuration

```bash
# Create .env file
cat > .env << EOF
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB=internship_db

# Scraping (optional)
SCRAPER_DEBUG=false                # Enable HTML debug capture
MAX_WORKERS=3                      # Parallel scrapers
REQUEST_TIMEOUT=30                 # Seconds per request
EOF
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

## 📊 Supported Job Sites

| Site | Scraper | Support | Auth | Notes |
|------|---------|---------|------|-------|
| **LinkedIn** | `linkedin.py` | ✅ Full | None | JavaScript heavy |
| **Indeed** | `indeed.py` | ✅ Full | None | Pagination support |
| **Naukri** | `naukri.py` | ✅ Full | None | India-focused |
| **Internshala** | `internshala.py` | ✅ Jobs + Internships | None | Student platform |
| **Wellfound** | `wellfound.py` | ✅ Full | None | Startup jobs |
| **Unstop** | `unstop.py` | ✅ Jobs + Competitions | None | Campus recruitment |
| **Glassdoor** | `glassdoor.py` | ✅ Full | None | Company reviews included |
| **Cutshort** | `cutshort.py` | ✅ Full | None | Tech-focused |
| **Company Portals** | `company_portals.py` | ✅ Multiple | None | Wipro, TCS, Infosys, etc |

## 🔄 Pipeline Flow

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

## 📝 Data Schema

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

## 🎛️ Command-Line Options

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

## 🔐 Environment Variables

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

## 📊 Performance

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

## 🐳 Docker

### Build

```bash
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

## 🔧 Troubleshooting

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

## 📊 Monitoring

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

## 🚀 Scheduling

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

## 📖 Related Services

- **Main API**: [services/README.md](../README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](../neural-generator/README.md)
- **RAG Service**: [services/api/rag/README.md](../rag/README.md)

## 🆘 Support

1. **Debug mode**: `SCRAPER_DEBUG=true python index.py --scrapers linkedin --max-pages 1`
2. **Check logs**: `tail -f crawler.log`
3. **Verify DB**: `psql -c "SELECT COUNT(*) FROM jobs"`
4. **Browser issues**: `playwright install`

## 📄 License

Part of Repo Sense project