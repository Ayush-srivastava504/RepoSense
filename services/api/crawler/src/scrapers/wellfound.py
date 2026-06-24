import os
import re
import json
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


BASE = "https://wellfound.com"


class WellfoundScraper(BaseScraper):

    source_name = "wellfound"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        keyword_str = (
            " ".join(keywords[:3])
            if keywords
            else "software engineer intern"
        )

        for job_type in ["intern", "full-time"]:
            for page in range(1, max_pages + 1):
                batch = self._fetch_page(
                    keyword_str,
                    locations,
                    job_type,
                    page,
                )
                if not batch:
                    break
                jobs.extend(batch)
                self.log.info(
                    "Wellfound %s page %d -> %d jobs",
                    job_type,
                    page,
                    len(batch),
                )

        self.log.info(
            "Collected %d jobs from wellfound",
            len(jobs),
        )

        return jobs

    def _fetch_page(
        self,
        keyword: str,
        locations: List[str],
        job_type: str,
        page: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        query = keyword.replace(" ", "%20")

        url = f"https://wellfound.com/jobs?q={query}&page={page}"

        try:
            html = self._render_page(url, wait_ms=8000)
        except Exception as e:
            self.log.warning("Wellfound browser error: %s", str(e))
            return []

        if os.getenv("SCRAPER_DEBUG"):
            with open("wellfound_debug.html", "w", encoding="utf-8") as f:
                f.write(html)

        soup = BeautifulSoup(html, "html.parser")

        # Try multiple selectors for job cards
        cards = self._find_cards(soup)
        self.log.info("Wellfound found %d cards", len(cards))

        for card in cards:
            try:
                job = self._parse_card(card, job_type)
                if job:
                    jobs.append(job)
            except Exception as e:
                self.log.debug("Error parsing Wellfound card: %s", str(e))
                continue

        # Also try JSON-LD extraction
        jobs.extend(self._extract_jsonld(soup, job_type))

        return jobs

    def _find_cards(self, soup) -> List:
        """Find job cards using multiple selector strategies."""
        selectors = [
            # Modern Wellfound selectors
            '[data-testid="StartupResult"]',
            '[data-testid="job-list-item"]',
            '.styles_component__UCLp3',
            '.styles_jobListItem__ivbD9',
            '.job-listing',
            # Fallback selectors
            '.job-card',
            '.job-item',
            '.startup-card',
            '.opportunity-card',
            'article.job',
            'div[data-job-id]',
            'li.job',
            '.position',
            '.role',
            # Generic fallbacks
            '[class*="job"]',
            '[class*="position"]',
            '[class*="role"]',
        ]

        for selector in selectors:
            cards = soup.select(selector)
            if cards:
                self.log.debug("Found cards with selector: %s", selector)
                return cards

        return []

    def _parse_card(self, card, job_type: str) -> Optional[Dict]:
        """Parse a single Wellfound job card."""
        job = self._empty_job()

        # Title - try multiple selectors
        title_el = (
            card.select_one("h2") or
            card.select_one("h3") or
            card.select_one(".title") or
            card.select_one(".job-title") or
            card.select_one(".role-title") or
            card.select_one("a[data-testid]") or
            card.select_one("a")
        )

        title = _clean(title_el.get_text(strip=True) if title_el else "")
        if not title:
            return None

        job["title"] = title

        # Company
        company_el = (
            card.select_one("h3") or
            card.select_one(".company-name") or
            card.select_one(".startup-name") or
            card.select_one("[data-testid='company-name']") or
            card.select_one(".company") or
            card.select_one("span")
        )
        job["company"] = _clean(company_el.get_text(strip=True) if company_el else "")

        # Location
        location_el = (
            card.select_one(".location") or
            card.select_one("[data-testid='location']") or
            card.select_one(".job-location") or
            card.select_one(".office-location")
        )
        job["location"] = _clean(location_el.get_text(strip=True) if location_el else "")

        # Salary
        salary_el = (
            card.select_one(".salary") or
            card.select_one("[data-testid='salary']") or
            card.select_one(".compensation") or
            card.select_one(".pay")
        )
        job["salary"] = _clean(salary_el.get_text(strip=True) if salary_el else "")

        # Description
        desc_el = (
            card.select_one(".description") or
            card.select_one(".job-description") or
            card.select_one(".role-description")
        )
        job["description"] = _clean(desc_el.get_text(strip=True) if desc_el else "")

        # Skills/Tags
        skills_el = card.select_one(".skills") or card.select_one(".tags")
        if skills_el:
            skills = skills_el.get_text(strip=True).split(",")
            job["skills"] = [s.strip() for s in skills if s.strip()]
        else:
            job["skills"] = []

        # Posted date
        posted_el = card.select_one(".posted-date") or card.select_one("time")
        job["posted_date"] = _clean(posted_el.get_text(strip=True) if posted_el else "")

        # Job type
        job["type"] = _map_job_type(job_type, job["title"])

        # Remote
        job["is_remote"] = (
            "remote" in job["location"].lower() or
            "remote" in job["description"].lower() or
            "remote" in job["title"].lower()
        )

        # Apply URL
        link_el = card.select_one("a")
        href = link_el.get("href") if link_el else ""
        if href:
            if href.startswith("http"):
                job["apply_url"] = href
            else:
                job["apply_url"] = urljoin(BASE, href)
        else:
            job["apply_url"] = ""

        # Experience level from title or description
        job["experience_required"] = _extract_experience(job["title"] + " " + job["description"])

        return job

    def _extract_jsonld(self, soup, job_type: str) -> List[Dict]:
        """Extract job data from JSON-LD scripts."""
        results = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                json_ld = json.loads(script.string or "{}")
            except Exception:
                continue

            items = json_ld if isinstance(json_ld, list) else [json_ld]
            for item in items:
                if isinstance(item, dict):
                    # Check for main job posting
                    if item.get("@type") == "JobPosting":
                        job = self._parse_jsonld(item, job_type)
                        if job:
                            results.append(job)
                    # Check for @graph
                    if item.get("@graph"):
                        for graph_item in item.get("@graph", []):
                            if graph_item.get("@type") == "JobPosting":
                                job = self._parse_jsonld(graph_item, job_type)
                                if job:
                                    results.append(job)

        return results

    def _parse_jsonld(self, json_ld: Dict, job_type: str) -> Optional[Dict]:
        """Parse a JSON-LD job posting."""
        job = self._empty_job()
        job["title"] = _clean(json_ld.get("title", ""))
        if not job["title"]:
            return None

        # Company
        org = json_ld.get("hiringOrganization", {})
        if isinstance(org, dict):
            job["company"] = _clean(org.get("name", ""))
        else:
            job["company"] = _clean(str(org or ""))

        # Location
        location = json_ld.get("jobLocation", {})
        if isinstance(location, dict):
            address = location.get("address", {})
            if isinstance(address, dict):
                job["location"] = _clean(
                    address.get("addressLocality", "") or
                    address.get("addressRegion", "") or
                    address.get("addressCountry", "")
                )
            else:
                job["location"] = _clean(str(address or ""))
        else:
            job["location"] = _clean(str(location or ""))

        # Description
        description = json_ld.get("description", "") or json_ld.get("jobDescription", "")
        if isinstance(description, str):
            description = re.sub(r"<[^>]+>", " ", description)
        job["description"] = _clean(description)

        # Dates
        job["posted_date"] = json_ld.get("datePosted", "") or json_ld.get("postedDate", "")
        job["deadline"] = json_ld.get("validThrough", "") or json_ld.get("expiryDate", "")

        # Salary
        salary = json_ld.get("baseSalary", {})
        if isinstance(salary, dict):
            value = salary.get("value", {})
            if isinstance(value, dict):
                job["salary"] = f"{value.get('minValue', '')} - {value.get('maxValue', '')} {value.get('unitText', '')}".strip()
            else:
                job["salary"] = _clean(str(value))
        else:
            job["salary"] = _clean(str(salary))

        # Type
        employment_type = json_ld.get("employmentType", "")
        job["type"] = _map_job_type(job_type, job["title"], employment_type)

        # Apply URL
        job["apply_url"] = json_ld.get("url", "") or json_ld.get("applyUrl", "")

        # Remote
        job["is_remote"] = (
            "remote" in job["location"].lower() or
            "remote" in job["description"].lower() or
            json_ld.get("jobLocationType", "").lower() == "remote"
        )

        # Experience
        job["experience_required"] = _extract_experience(job["title"] + " " + job["description"])

        return job

    def _parse(self, raw: Dict) -> Optional[Dict]:
        """Legacy parse method for API responses."""
        return raw


def _clean(text: str) -> str:
    """Clean text by removing extra whitespace."""
    return re.sub(r"\s+", " ", text or "").strip()


def _map_job_type(job_type: str, title: str, employment_type: str = "") -> str:
    """Map job type to standard values."""
    title_lower = (title or "").lower()
    
    # Check employment type first
    if employment_type:
        mapping = {
            "FULL_TIME": "full-time",
            "PART_TIME": "part-time",
            "INTERN": "internship",
            "INTERNSHIP": "internship",
            "CONTRACT": "contract",
            "CONTRACTOR": "contract",
            "TEMPORARY": "contract",
            "FREELANCE": "contract",
        }
        if employment_type.upper() in mapping:
            return mapping[employment_type.upper()]
    
    # Check job_type parameter
    if job_type == "intern":
        return "internship"
    
    # Infer from title
    if "intern" in title_lower:
        return "internship"
    if "contract" in title_lower or "freelance" in title_lower:
        return "contract"
    
    return "full-time"


def _extract_experience(text: str) -> str:
    """Extract experience requirement from text."""
    text = text.lower()
    
    # Look for patterns like "2+ years", "3-5 years", "entry level", etc.
    patterns = [
        r'(\d+)\s*\+\s*(?:years?|yrs?)',
        r'(\d+)\s*[-–]\s*(\d+)\s*(?:years?|yrs?)',
        r'(entry\s*level)',
        r'(senior)',
        r'(lead)',
        r'(junior)',
        r'(fresher)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0)
    
    return ""