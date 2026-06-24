import json
import os
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from utils import safe_get


BASE = "https://www.naukri.com"
SEARCH_API = f"{BASE}/jobapi/v2/search"
HEADERS = {
    "Referer": "https://www.naukri.com/jobs-in-india",
    "X-Http-Method-Override": "GET",
    "Appid": "109",
    "Systemid": "109",
    "Accept": "application/json",
}


class NaukriScraper(BaseScraper):
    source_name = "naukri"

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        jobs: List[Dict] = []
        keyword_pairs = [
            ("fresher jobs", "India"),
            ("internship", "India"),
            ("entry level software engineer", "India"),
        ]

        for keyword, location in keyword_pairs:
            for page in range(1, max_pages + 1):
                # Add delay between requests
                time.sleep(2)
                batch = self._search(keyword, location, page)
                if not batch:
                    break
                jobs.extend(batch)
                self.log.info("Naukri kw=%r page=%d -> %d results", keyword, page, len(batch))

        self.log.info("Collected %d jobs from naukri", len(jobs))
        return jobs

    def _search(self, keyword: str, location: str, page: int) -> List[Dict]:
        params = {
            "noOfResults": 20,
            "urlType": "search_by_keyword",
            "searchType": "adv",
            "keyword": keyword,
            "location": location,
            "pageNo": page,
            "k": keyword,
            "l": location,
            "seoKey": f"{keyword.replace(' ', '-')}-jobs",
            "src": "jobsearchDesk",
            "latLong": "",
        }

        # Try API first with shorter timeout
        try:
            response = safe_get(
                self.session, 
                SEARCH_API, 
                params=params, 
                headers=HEADERS, 
                domain_key="naukri",
                timeout=15  # Shorter timeout
            )
            
            if response:
                try:
                    data = response.json()
                    raw_jobs = data.get("jobDetails", []) or data.get("jobs", [])
                    parsed = [job for job in (self._parse_api(raw) for raw in raw_jobs) if job]
                    if parsed:
                        return parsed
                except Exception as e:
                    self.log.warning("Naukri API parse failed: %s", str(e))
        except Exception as e:
            self.log.warning("Naukri API request failed: %s", str(e))

        # Fallback to HTML scraping
        return self._scrape_html(keyword, location, page)

    def _parse_api(self, raw: Dict) -> Optional[Dict]:
        job = self._empty_job()
        job["title"] = _clean(raw.get("title", ""))
        job["company"] = _clean(raw.get("companyName", ""))

        placeholders = raw.get("placeholders", {})
        if isinstance(placeholders, dict):
            job["location"] = ", ".join(placeholders.get("location", "").split(",")[:3])
        else:
            job["location"] = raw.get("location", "")

        job["salary"] = raw.get("salary", "")
        job["experience_required"] = raw.get("experienceText", "")
        job["description"] = _clean(raw.get("jobDescription", ""))

        if raw.get("tagsAndSkills"):
            skills = raw.get("tagsAndSkills", "").split(",")
            job["skills"] = [skill.strip() for skill in skills if skill.strip()]
        else:
            job["skills"] = []

        job["posted_date"] = str(raw.get("footerPlaceholderLabel", ""))
        job["type"] = _infer_type(job["title"] + " " + job.get("experience_required", ""))
        job["is_remote"] = "remote" in job["location"].lower()

        apply_url = raw.get("jdURL", "")
        if apply_url and not apply_url.startswith("http"):
            apply_url = urljoin(BASE, apply_url)
        job["apply_url"] = apply_url

        return job if job["title"] else None

    def _scrape_html(self, keyword: str, location: str, page: int) -> List[Dict]:
        # Build URL for HTML search
        slug = f"{keyword.replace(' ', '-')}-jobs-in-{location.replace(' ', '-').lower()}"
        url = f"{BASE}/{slug}-{page}"
        self.log.info("Naukri HTML scrape: %s", url)

        try:
            html = self._render_page(url, wait_ms=8000)
        except Exception as e:
            self.log.warning("Naukri HTML render error: %s", str(e))
            return []

        if os.getenv("SCRAPER_DEBUG"):
            with open("naukri_debug.html", "w", encoding="utf-8") as f:
                f.write(html)

        soup = BeautifulSoup(html, "html.parser")
        
        # Try multiple selectors for job cards
        selectors = [
            'article.jobTuple',
            '.jobTuple',
            '[data-job-id]',
            '.cust-job-tuple',
            '.srp-jobtuple-wrapper',
            '[class*="jobTuple"]',
            '[class*="cust-job"]',
            'li[data-job-id]',
            '.job-listing',
        ]

        cards = []
        for selector in selectors:
            cards = soup.select(selector)
            if cards:
                self.log.info("Naukri found %d cards with selector: %s", len(cards), selector)
                break

        if not cards:
            self.log.warning("No job cards found on Naukri page")
            # Try to extract from script tags
            return self._extract_from_scripts(soup)

        results = []
        for card in cards:
            try:
                job = self._parse_html_card(card)
                if job:
                    results.append(job)
            except Exception as e:
                self.log.debug("Error parsing card: %s", str(e))
                continue

        # Also try JSON-LD extraction
        results.extend(self._extract_jsonld(soup))
        
        self.log.info("Naukri extracted %d jobs from HTML", len(results))
        return results

    def _parse_html_card(self, card) -> Optional[Dict]:
        """Parse a single job card from HTML."""
        job = self._empty_job()

        # Title
        title_el = (
            card.select_one("a.title") or 
            card.select_one(".job-title") or 
            card.select_one("h2") or 
            card.select_one("a")
        )
        job["title"] = _clean(title_el.get_text(strip=True) if title_el else "")
        if not job["title"]:
            return None

        # Company
        company_el = (
            card.select_one(".company-name") or
            card.select_one(".comp-name") or
            card.select_one(".company") or
            card.select_one("h3")
        )
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")

        # Location
        location_el = (
            card.select_one(".loc") or
            card.select_one(".location") or
            card.select_one(".job-location")
        )
        job["location"] = _clean(location_el.get_text(strip=True) if location_el else "")

        # Salary
        salary_el = card.select_one(".salary") or card.select_one(".ctc")
        job["salary"] = _clean(salary_el.get_text(strip=True) if salary_el else "")

        # Experience
        exp_el = card.select_one(".experience") or card.select_one(".exp")
        job["experience_required"] = _clean(exp_el.get_text(strip=True) if exp_el else "")

        # Description
        job["description"] = _clean(card.get_text(" ", strip=True))

        # Skills
        skills_el = card.select_one(".skills") or card.select_one(".tags")
        if skills_el:
            skills = skills_el.get_text(strip=True).split(",")
            job["skills"] = [s.strip() for s in skills if s.strip()]
        else:
            job["skills"] = []

        job["posted_date"] = ""
        job["type"] = _infer_type(job["title"] + " " + job.get("experience_required", ""))
        job["is_remote"] = "remote" in job["location"].lower()

        # Apply URL
        link_el = card.select_one("a")
        href = link_el.get("href") if link_el else ""
        job["apply_url"] = href if href.startswith("http") else (urljoin(BASE, href) if href else "")

        return job

    def _extract_from_scripts(self, soup) -> List[Dict]:
        """Extract jobs from script tags if card selectors fail."""
        results = []
        
        # Look for JSON-LD
        results.extend(self._extract_jsonld(soup))
        
        # Look for window.__INITIAL_STATE__ or similar
        for script in soup.select('script'):
            if script.string and 'window.__INITIAL_STATE__' in script.string:
                try:
                    # Extract JSON from script
                    match = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.*?});', script.string, re.DOTALL)
                    if match:
                        data = json.loads(match.group(1))
                        # Try to find jobs in the data
                        jobs = self._extract_from_state(data)
                        if jobs:
                            results.extend(jobs)
                except Exception:
                    pass
        
        return results

    def _extract_from_state(self, data: Dict) -> List[Dict]:
        """Extract jobs from state data if available."""
        results = []
        
        # Try common paths for job data
        paths = [
            ['jobDetails'],
            ['jobs'],
            ['search', 'results'],
            ['data', 'jobs'],
            ['jobSearch', 'jobs'],
        ]
        
        for path in paths:
            current = data
            try:
                for key in path:
                    current = current.get(key, {})
                if isinstance(current, list):
                    for item in current:
                        job = self._parse_api(item)
                        if job:
                            results.append(job)
            except Exception:
                continue
        
        return results

    def _extract_jsonld(self, soup) -> List[Dict]:
        """Extract jobs from JSON-LD scripts."""
        results = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                json_ld = json.loads(script.string)
            except Exception:
                continue

            items = json_ld if isinstance(json_ld, list) else [json_ld]
            for item in items:
                if isinstance(item, dict) and item.get("@type") == "JobPosting":
                    job = self._parse_jsonld(item)
                    if job:
                        results.append(job)
                    
                # Also check for @graph which may contain multiple job postings
                if isinstance(item, dict) and item.get("@graph"):
                    for graph_item in item.get("@graph", []):
                        if graph_item.get("@type") == "JobPosting":
                            job = self._parse_jsonld(graph_item)
                            if job:
                                results.append(job)

        return results

    def _parse_jsonld(self, json_ld: Dict) -> Optional[Dict]:
        """Parse a JSON-LD job posting."""
        job = self._empty_job()
        job["title"] = _clean(json_ld.get("title", ""))
        if not job["title"]:
            return None

        job["company"] = _clean(json_ld.get("hiringOrganization", {}).get("name", ""))
        
        # Handle location
        job_location = json_ld.get("jobLocation", {})
        if isinstance(job_location, dict):
            address = job_location.get("address", {})
            job["location"] = _clean(
                address.get("addressLocality", "") or 
                address.get("addressRegion", "") or 
                address.get("addressCountry", "")
            )
        else:
            job["location"] = _clean(str(job_location or ""))

        # Handle salary
        salary = json_ld.get("baseSalary", {})
        if isinstance(salary, dict):
            value = salary.get("value", {})
            if isinstance(value, dict):
                job["salary"] = f"{value.get('minValue', '')} - {value.get('maxValue', '')} {value.get('unitText', '')}".strip()
            else:
                job["salary"] = str(value)
        else:
            job["salary"] = str(salary)

        # Description
        description = json_ld.get("description", "") or json_ld.get("jobDescription", "")
        if isinstance(description, str):
            description = re.sub(r"<[^>]+>", " ", description)
        job["description"] = _clean(description)

        job["posted_date"] = json_ld.get("datePosted", "") or json_ld.get("postedDate", "")
        job["type"] = _map_employment_type(json_ld.get("employmentType", ""))
        job["apply_url"] = json_ld.get("url", "") or json_ld.get("applyUrl", "")
        job["is_remote"] = "remote" in job["location"].lower() or "remote" in job["description"].lower()

        return job


def _clean(text: str) -> str:
    """Clean text by removing extra whitespace."""
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _text(soup, selector: str) -> str:
    """Get text from a BeautifulSoup element."""
    element = soup.select_one(selector)
    return _clean(element.get_text()) if element else ""


def _infer_type(text: str) -> str:
    """Infer job type from text."""
    text = (text or "").lower()
    if "intern" in text:
        return "internship"
    if "contract" in text or "freelance" in text:
        return "contract"
    return "full-time"


def _map_employment_type(employment_type: str) -> str:
    """Map employment type to standard values."""
    mapping = {
        "FULL_TIME": "full-time",
        "PART_TIME": "part-time",
        "INTERN": "internship",
        "INTERNSHIP": "internship",
        "TEMPORARY": "contract",
        "CONTRACTOR": "contract",
        "CONTRACT": "contract",
        "FREELANCE": "contract",
    }
    return mapping.get((employment_type or "").upper(), "full-time")