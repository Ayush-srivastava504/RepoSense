"""
Central configuration for the Job Aggregator Crawler Pipeline.
All timeouts, URLs, headers, retry settings, and storage config live here.
"""

import os
from typing import List, Dict

# Storage configuration
S3_BUCKET = os.getenv("S3_BUCKET", "job-crawler-raw")
S3_PREFIX = os.getenv("S3_PREFIX", "jobs/")
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "jobs")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

# Runtime configuration
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "8"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BACKOFF = float(os.getenv("RETRY_BACKOFF", "2.0"))
RATE_LIMIT_DELAY = float(os.getenv("RATE_LIMIT_DELAY", "1.5"))

# Proxy and stealth configuration
USE_PROXY = os.getenv("USE_PROXY", "false").lower() == "true"
PROXY_LIST = os.getenv("PROXY_LIST", "").split(",")
ROTATE_UA = os.getenv("ROTATE_UA", "true").lower() == "true"

# Selenium and Playwright configuration
HEADLESS = os.getenv("HEADLESS", "true").lower() == "true"
CHROME_BINARY = os.getenv("CHROME_BINARY", "/usr/bin/google-chrome")
CHROMEDRIVER_PATH = os.getenv("CHROMEDRIVER_PATH", "/usr/bin/chromedriver")
PAGE_LOAD_TIMEOUT = int(os.getenv("PAGE_LOAD_TIMEOUT", "60"))

# Credentials
LINKEDIN_EMAIL = os.getenv("LINKEDIN_EMAIL", "")
LINKEDIN_PASSWORD = os.getenv("LINKEDIN_PASSWORD", "")

# Search configuration
DEFAULT_KEYWORDS = [
    "internship",
    "fresher",
    "graduate trainee",
    "junior developer",
    "software engineer",
    "software developer",
    "data analyst",
    "data engineer",
    "python developer",
    "devops engineer",
    "system analyst",
    "ai engineer",
    "machine learning engineer",
]

DEFAULT_LOCATIONS = [
    "India",
    "Remote",
    "Bangalore",
    "Mumbai",
    "Delhi",
    "Hyderabad",
    "Pune",
    "Chennai",
    "Kolkata",
    "Noida",
    "Gurgaon",
]

DEFAULT_JOB_TYPES = [
    "internship",
    "full-time",
    "contract",
]

MAX_PAGES_PER_SOURCE = int(os.getenv("MAX_PAGES_PER_SOURCE", "10"))

# Remote Jobs section — sources: Remote OK, We Work Remotely,
# Remotive, HiringCafe (see scrapers/remoteok.py, weworkremotely.py,
# remotive.py, hiringcafe.py). These are used as fallback search terms
# for sources that support server-side filtering (Remotive, HiringCafe);
# Remote OK is a broad feed that's then filtered client-side.
REMOTE_KEYWORDS: List[str] = [
    "software engineer",
    "frontend developer",
    "backend developer",
    "full stack developer",
    "python developer",
    "data engineer",
    "data analyst",
    "devops engineer",
    "system analyst",
    "ai engineer",
    "machine learning engineer",
    "product manager",
]

# Government Jobs section — sources: Employment News (department/office,
# post/notification, vacancies are already present in its listings), plus
# FreeJobAlert, a long-running third-party aggregator that republishes
# UPSC/SSC/Railways/Banking/State PSC/Police/Defence/Teaching notices.
# We intentionally scrape the aggregator rather than SSC/UPSC's own
# .gov.in/.nic.in portals directly — those are more likely to rate-limit
# or block automated access, and are best left alone rather than risking
# it. See scrapers/freejobalert.py for details.
GOVERNMENT_KEYWORDS: List[str] = [
    "recruitment",
    "vacancy",
    "notification",
]

# User agent pool
USER_AGENTS: List[str] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",

    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",

    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) "
    "Gecko/20100101 Firefox/124.0",

    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) "
    "Version/17.4 Safari/605.1.15",
]

# Enabled scrapers
#
# Naukri, Indeed, Glassdoor, and Wellfound were removed entirely (not just
# excluded from the default list): they're protected (heavy anti-bot /
# login walls) and broke often, so they cost more crawl budget than the
# jobs they yielded. HiringCafe (scrapers/hiringcafe.py) replaces Wellfound
# as the remote-jobs-focused source in this default list.
#
# Himalayas and Europe/Himalayas were REMOVED entirely (not just disabled):
# both consistently returned 0 jobs — Himalayas' public API started
# rate-limiting/blocking this crawler's traffic hard enough that retries
# never recovered within a run. RemoteOK/WeWorkRemotely/Remotive already
# cover the same remote-jobs space, so nothing needed to replace it.
#
# NOTE: this list is the *default* only. It's overridden by whatever
# ENABLED_SCRAPERS env var is set, and — for the production cron/Docker
# path — by the --scrapers flag baked into infrastructure/docker/
# docker-compose.yml's `crawler` service `command`. A scraper being in
# this list does NOT mean it runs in production; check that compose file
# (or the actual crontab on the box) for what really executes on a
# schedule. See crawler/README.md "Scheduling" section.
ENABLED_SCRAPERS: List[str] = os.getenv(
    "ENABLED_SCRAPERS",
    "internshala,linkedin,hiringcafe,"
    "unstop,cutshort,company_portals,"
    "remoteok,weworkremotely,remotive,"
    "japan_jobs,japan_internships,"
    "europe_jobicy,europe_arbeitnow,europe_remotive,"
    "europe_weworkremotely,europe_remoteok,"
    "employment_news,freejobalert,"
    "greenhouse,lever,ashby,smartrecruiters,workable,"
    "generic_boards",
).split(",")

# ATS (Applicant Tracking System) company registry — "smart crawlers"
#
# Greenhouse/Lever/Ashby/SmartRecruiters/Workable each publish one public,
# unauthenticated JSON API per company job board. There is no "search all
# companies" endpoint on any of them — you fetch board-by-board using the
# company's board token/slug. That means growing these crawlers is just
# adding tokens below; no new scraper code needed (see
# scrapers/ats_common.py + scrapers/greenhouse.py / lever.py / ashby.py /
# smartrecruiters.py / workable.py).
#
# IMPORTANT: this is a starter seed list, not verified against live
# traffic (this environment has no outbound network access to check it).
# Companies switch ATS providers over time and a stale token just 404s
# harmlessly (logged, doesn't crash the run) — but before relying on this
# in production, spot check a few, e.g.:
#   curl https://boards-api.greenhouse.io/v1/boards/<token>/jobs
#   curl https://api.lever.co/v0/postings/<token>?mode=json
# and prune/replace any that don't resolve. Add as many tokens as you
# want per platform; each one is a full board of jobs, so this scales to
# the 5,000-30,000/platform ranges you're targeting purely by list size.
ATS_COMPANIES: Dict[str, List[str]] = {
    # notion/docusign/doordash confirmed 404 (moved off Greenhouse) in a
    # live run and were dropped; the rest of this list confirmed working.
    "greenhouse": [
        "stripe", "airbnb", "coinbase", "robinhood", "gitlab", "figma",
        "discord", "cloudflare", "dropbox", "asana",
        "affirm", "squarespace", "pinterest", "reddit",
        "instacart", "twitch", "brex",
        "databricks", "snowflake", "mongodb", "hashicorp", "confluent",
        "elastic", "twilio", "roblox", "unity", "zscaler", "crowdstrike",
        "palantir", "webflow", "rippling", "deel", "vercel", "scaleai",
        "anthropic", "duolingo", "toast", "carta", "gusto", "justworks",
        "benchling", "samsara", "klaviyo", "amplitude", "sourcegraph",
        "circleci", "pagerduty", "grafana-labs", "okta", "netskope",
    ],
    # Every token below 404'd or JSON-decode-failed on the last live run
    # (see crawler logs); netflix/shopify/canva/reddit aren't actually on
    # Lever. Replaced with candidates believed to be real Lever/Ashby
    # users — still unverified here (no outbound network), spot-check
    # with `curl https://api.lever.co/v0/postings/<token>?mode=json`
    # (Lever) or `curl https://api.ashbyhq.com/posting-api/job-board/<token>`
    # (Ashby) before relying on them.
    # eventbrite/netlify/loom/shipt/papaya-global/getir all 404'd on the
    # last live run (see crawler logs) — dropped and replaced with
    # anchorage/wealthsimple, both confirmed live Lever customers as of
    # this edit. plaid/kraken are real tokens too; a 0-job result for them
    # is a legitimately empty board, not a broken token — check
    # `curl https://api.lever.co/v0/postings/<token>?mode=json` before
    # assuming any token here is stale.
    "lever": [
        "plaid", "kraken", "anchorage", "wealthsimple",
    ],
    "ashby": [
        "mercury", "ramp", "openai", "linear", "vanta",
    ],
    "smartrecruiters": [
        "Visa", "Bosch", "McDonalds", "Adidas", "Ikea", "Yourfoodjob",
    ],
    # "workable" was a literal placeholder token (not a real company slug)
    # and 404'd every run — replaced with huggingface, a confirmed live
    # Workable customer. Verify with
    # `curl https://apply.workable.com/api/v1/widget/accounts/<slug>`
    # before trusting any slug here long-term; Workable doesn't publish a
    # customer directory so there's no way to auto-discover replacements.
    "workable": [
        "huggingface", "typeform", "deelhq",
    ],
}

# Generic structured-data boards — for platforms/sites with no shared
# public JSON API (Jobvite, iCIMS, Teamtailor) and for standalone sites
# that aren't an ATS platform at all (JapanDev, TokyoDev, internship
# aggregators like GradConnection/Prosple/WayUp/Parker Dewey). See
# scrapers/generic_boards.py — it reads each site's own schema.org
# JobPosting structured data (what the site already publishes for Google
# for Jobs) rather than hand-maintained CSS selectors, and falls back to
# a conservative link-text heuristic if a page has none.
#
# Each entry needs a real, working listing/search URL — the placeholders
# below are NOT verified (no outbound network in this environment) and
# should be swapped in/uncommented with the actual board URLs before this
# scraper is relied on. `source_tag` groups multiple URLs under one
# crawler-summary bucket (e.g. several company Jobvite instances all
# tagged "jobvite").
GENERIC_BOARDS: List[Dict[str, str]] = [
    {"name": "JapanDev", "url": "https://japan-dev.com/jobs", "source_tag": "japandev"},
    {"name": "TokyoDev", "url": "https://www.tokyodev.com/jobs", "source_tag": "tokyodev"},
    {"name": "Prosple India", "url": "https://in.prosple.com/search-jobs", "source_tag": "prosple"},
    {"name": "WayUp", "url": "https://www.wayup.com/s/internships/", "source_tag": "wayup"},
    # {"name": "Example Jobvite company", "url": "https://jobs.jobvite.com/<company>", "source_tag": "jobvite", "company_hint": "Example Co"},
]

# Company portal configuration
COMPANY_PORTALS: Dict[str, Dict] = {
    "tech_mahindra": {
        "name": "Tech Mahindra",
        "base_url": "https://internship.techmahindra.com",
        "jobs_url": "https://internship.techmahindra.com/",
        "type": "html",
        "selectors": {
            "job_cards": ".job-card, .internship-card, .opportunity-card, article.job",
            "title": "h2, h3, .title, .job-title",
            "location": ".location, [class*='location']",
            "stipend": ".stipend, .salary, [class*='stipend']",
            "duration": ".duration, [class*='duration']",
            "apply_link": "a[href*='apply'], a.apply-btn, a.btn-apply",
        },
    },

    "tcs": {
        "name": "TCS",
        "base_url": "https://www.tcs.com",
        "jobs_url": "https://ibegin.tcs.com/iBegin/",
        "type": "html",
        "selectors": {
            "job_cards": ".job-listing, .career-card, tr.jobRow",
            "title": ".job-title, td:first-child",
            "location": ".location, td.location",
            "apply_link": "a[href*='job'], a.apply",
        },
    },

    "infosys": {
        "name": "Infosys",
        "base_url": "https://career.infosys.com",
        "jobs_url": "https://career.infosys.com/jobdesc?jobReferenceCode=INFSYS",
        "type": "html",
        "selectors": {
            "job_cards": ".job-item, .career-listing-item",
            "title": ".job-title, h3",
            "location": ".location",
            "apply_link": "a.apply-now, a[href*='apply']",
        },
    },

    "wipro": {
        "name": "Wipro",
        "base_url": "https://careers.wipro.com",
        "jobs_url": "https://careers.wipro.com/careers-home/jobs",
        "type": "html",
        "params": {
            "location": "India",
            "category": "Engineering",
        },
        "selectors": {
            "job_cards": "li.job-tile, .job-result",
            "title": "h2.job-title, .title",
            "location": ".job-location, .location",
            "apply_link": "a[href*='/jobs/']",
        },
    },
}

# Skill normalization aliases
SKILL_ALIASES: Dict[str, List[str]] = {
    "python": ["python3", "py", "python programming"],
    "javascript": ["js", "javascript/typescript", "vanilla js"],
    "typescript": ["ts", "typescript/javascript"],
    "react": ["reactjs", "react.js", "react js"],
    "nodejs": ["node.js", "node js", "express.js", "expressjs"],
    "machine learning": ["ml", "machine-learning", "machine learning (ml)"],
    "deep learning": ["dl", "deep-learning"],
    "sql": ["mysql", "postgresql", "postgres", "sql server", "sqlite"],
    "aws": ["amazon web services", "amazon aws"],
    "docker": ["containerization", "docker/kubernetes"],
    "kubernetes": ["k8s", "kube"],
    "java": ["java8", "java 8", "core java", "java programming"],
    "c++": ["cpp", "c plus plus"],
    "data analysis": ["data analytics", "data analyst"],
}

# Job type normalization
JOB_TYPE_MAP: Dict[str, str] = {
    "intern": "internship",
    "internship": "internship",
    "full time": "full-time",
    "full-time": "full-time",
    "fulltime": "full-time",
    "part time": "part-time",
    "part-time": "part-time",
    "contract": "contract",
    "freelance": "contract",
    "temporary": "contract",
}