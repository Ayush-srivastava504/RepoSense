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
NAUKRI_EMAIL = os.getenv("NAUKRI_EMAIL", "")
NAUKRI_PASSWORD = os.getenv("NAUKRI_PASSWORD", "")

# Search configuration
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
ENABLED_SCRAPERS: List[str] = os.getenv(
    "ENABLED_SCRAPERS",
    "internshala,naukri,linkedin,wellfound,indeed,"
    "unstop,glassdoor,cutshort,company_portals",
).split(",")

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