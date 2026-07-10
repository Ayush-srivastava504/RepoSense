"""
HiringCafe — https://hiring.cafe

AI-enriched remote-job aggregator (2.8M+ listings pulled from 46+ ATS
platforms — Greenhouse, Lever, Workday, BambooHR, etc). Added here as a
replacement for Naukri/Glassdoor/Indeed/Wellfound, all of which sit
behind heavy anti-bot protection (login walls, aggressive rate-limiting,
frequent markup churn) and cost more crawl budget than the jobs they
reliably yield.

HiringCafe isn't friction-free either — third-party write-ups on its
public API note that the old unauthenticated `/api/search-jobs` POST
endpoint has become unreliable and the site now leans on a Next.js
server-rendered search payload behind Cloudflare. So this scraper, like
wellfound.py before it, takes a multi-strategy approach instead of
trusting a single response shape:

  1. Try the legacy `/api/search-jobs` POST endpoint directly (cheap,
     no browser, and still works some of the time).
  2. If that comes back empty, fall back to loading the search page in
     a real browser and reading whatever the page hydrates from —
     either the `__NEXT_DATA__` payload or any XHR/fetch response that
     looks like a job-search API call — the same pattern used for
     Wellfound.
  3. If neither yields anything, fall back to a structural HTML pass
     over rendered job cards.

None of hiring.cafe's exact JSON field names are documented publicly,
so `_find_job_like_dicts` / `_normalize` below deliberately don't hard
-code a schema — they walk whatever comes back looking for dict shapes
that look like a job record (title + at least one supporting field),
same as wellfound.py. This is intentionally defensive: verify against a
live response and adjust field names if HiringCafe's payload shape
differs from what's assumed here.
"""

import json
import re
from typing import Dict, List, Optional
from urllib.parse import quote, urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from utils import safe_post


BASE = "https://hiring.cafe"
SEARCH_JOBS_ENDPOINT = f"{BASE}/api/search-jobs"
SEARCH_PAGE = f"{BASE}/"

API_HINTS = (
    "search-jobs",
    "searchState",
)

API_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Referer": f"{BASE}/",
    "Origin": BASE,
}


def _build_search_state(keyword: str) -> Dict:
    return {
        "locations": [],
        "workplaceTypes": ["Remote"],
        "defaultToUserLocation": False,
        "userLocation": None,
        "currency": {"label": "Any", "value": None},
        "frequency": {"label": "Any", "value": None},
        "commitmentTypes": [
            "Full Time",
            "Part Time",
            "Contract",
            "Internship",
        ],
        "jobTitleQuery": "",
        "jobDescriptionQuery": "",
        "seniorityLevel": [
            "No Prior Experience Required",
            "Entry Level",
            "Mid Level",
        ],
        "roleTypes": ["Individual Contributor"],
        "searchQuery": keyword,
        "dateFetchedPastNDays": 30,
        "hiddenCompanies": [],
        "user": None,
        "searchModeSelectedCompany": None,
        "departments": [],
        "restrictedSearchAttributes": [],
        "sortBy": "date",
        "technologyKeywordsQuery": "",
        "requirementsKeywordsQuery": "",
        "companyPublicOrPrivate": "all",
        "companySizeRanges": [],
    }


class HiringCafeScraper(BaseScraper):

    source_name = "hiringcafe"
    uses_browser = True

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []
        seen_urls = set()

        keyword_list = keywords[:3] if keywords else ["software engineer"]

        for keyword in keyword_list:

            batch = self._fetch_via_api(keyword)

            if not batch:
                batch = self._fetch_via_browser(keyword)

            for job in batch:
                url = job.get("apply_url") or ""
                if url and url in seen_urls:
                    continue
                if url:
                    seen_urls.add(url)
                jobs.append(job)

        self.log.info("HiringCafe collected %d jobs", len(jobs))
        return jobs

    # ------------------------------------------------------------------
    # Strategy 1: direct POST to the (semi-reliable) legacy JSON API
    # ------------------------------------------------------------------

    def _fetch_via_api(self, keyword: str) -> List[Dict]:

        search_state = _build_search_state(keyword)

        resp = safe_post(
            self.session,
            SEARCH_JOBS_ENDPOINT,
            json_data={
                "size": 100,
                "page": 0,
                "searchState": search_state,
            },
            headers=API_HEADERS,
            domain_key="hiringcafe",
        )

        if resp is None:
            return []

        try:
            data = resp.json()
        except Exception:
            return []

        raw_jobs = []
        for key in ("results", "jobs", "data", "items", "content"):
            if isinstance(data, dict) and isinstance(data.get(key), list):
                raw_jobs = data[key]
                break

        if not raw_jobs and isinstance(data, dict) and isinstance(data.get("hits"), dict):
            hits = data["hits"].get("hits", [])
            raw_jobs = [h.get("_source", h) for h in hits if isinstance(h, dict)]

        if not raw_jobs and isinstance(data, list):
            raw_jobs = data

        jobs = []
        for raw in raw_jobs:
            if not isinstance(raw, dict):
                continue
            job = self._normalize(raw)
            if job:
                jobs.append(job)

        if jobs:
            self.log.info("HiringCafe: got %d jobs via direct API for %r", len(jobs), keyword)

        return jobs

    # ------------------------------------------------------------------
    # Strategy 2/3: browser fallback — hydration payload, captured
    # network responses, then structural HTML
    # ------------------------------------------------------------------

    def _fetch_via_browser(self, keyword: str) -> List[Dict]:

        search_state = _build_search_state(keyword)
        url = f"{BASE}/?searchState={quote(json.dumps(search_state))}"

        captured_responses: List[dict] = []

        def handle_response(response):
            try:
                req_url = response.url
                if not any(hint in req_url for hint in API_HINTS):
                    return
                content_type = response.headers.get("content-type", "")
                if "json" not in content_type:
                    return
                captured_responses.append(response.json())
            except Exception:
                pass

        try:
            page_obj = self.new_page()
        except Exception as exc:
            self.log.warning("HiringCafe browser launch error: %s", exc)
            return []

        try:
            page_obj.on("response", handle_response)

            try:
                self.goto(page_obj, url)
            except Exception as exc:
                self.log.warning("HiringCafe navigation error: %s", exc)
                return []

            page_obj.wait_for_timeout(5000)

            try:
                for _ in range(3):
                    page_obj.mouse.wheel(0, 3000)
                    page_obj.wait_for_timeout(1200)
            except Exception:
                pass

            html = page_obj.content()

        finally:
            page_obj.context.close()

        soup = BeautifulSoup(html, "html.parser")

        jobs = self._from_next_data(soup)
        if jobs:
            self.log.info("HiringCafe: got %d jobs from __NEXT_DATA__", len(jobs))
            return jobs

        jobs = self._from_captured_responses(captured_responses)
        if jobs:
            self.log.info(
                "HiringCafe: got %d jobs from intercepted network responses",
                len(jobs),
            )
            return jobs

        jobs = self._from_html_structure(soup)
        if jobs:
            self.log.info("HiringCafe: got %d jobs from structural HTML fallback", len(jobs))
            return jobs

        self.log.warning("HiringCafe: 0 jobs from all strategies for %r", keyword)
        return []

    def _from_next_data(self, soup) -> List[Dict]:
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return []

        try:
            data = json.loads(script.string)
        except Exception:
            return []

        jobs = []
        for raw in _find_job_like_dicts(data):
            job = self._normalize(raw)
            if job:
                jobs.append(job)
        return jobs

    def _from_captured_responses(self, responses: List[dict]) -> List[Dict]:
        jobs = []
        for data in responses:
            for raw in _find_job_like_dicts(data):
                job = self._normalize(raw)
                if job:
                    jobs.append(job)
        return jobs

    def _from_html_structure(self, soup) -> List[Dict]:
        link_pattern = re.compile(r"/(job|jobs|apply)/[^/?#]+", re.I)
        anchors = [
            a for a in soup.find_all("a", href=True) if link_pattern.search(a["href"])
        ]

        jobs = []
        seen = set()

        for a in anchors:
            title = _clean(a.get_text(" ", strip=True))
            if not title or len(title) < 4:
                continue

            href = a["href"]
            apply_url = href if href.startswith("http") else urljoin(BASE, href)
            if apply_url in seen:
                continue
            seen.add(apply_url)

            container = a
            for _ in range(4):
                if container.parent:
                    container = container.parent

            description = _clean(container.get_text(" ", strip=True))[:500]

            jobs.append({
                "title": title,
                "company": "",
                "location": "Remote",
                "type": "full-time",
                "description": description,
                "apply_url": apply_url,
                "is_remote": True,
                "country": "Worldwide",
            })

        return jobs

    def _normalize(self, raw: Dict) -> Optional[Dict]:

        title = _clean(
            raw.get("title")
            or raw.get("job_title")
            or raw.get("jobTitle")
            or raw.get("role_title")
            or ""
        )
        if not title:
            return None

        company = raw.get("company") or raw.get("company_name") or raw.get("employer") or {}
        if isinstance(company, dict):
            company_name = _clean(company.get("name", ""))
        else:
            company_name = _clean(str(company))

        location = (
            raw.get("location")
            or raw.get("formatted_location")
            or raw.get("locationName")
            or "Remote"
        )
        if isinstance(location, dict):
            location = location.get("name", "") or location.get("city", "") or "Remote"
        location = _clean(str(location)) or "Remote"

        workplace_type = str(
            raw.get("workplace_type") or raw.get("workplaceType") or ""
        ).lower()
        is_remote = (
            "remote" in workplace_type
            or "remote" in location.lower()
            or bool(raw.get("is_remote"))
        )

        salary = raw.get("salary") or raw.get("compensation") or ""
        if isinstance(salary, dict):
            low = salary.get("min") or salary.get("low")
            high = salary.get("max") or salary.get("high")
            if low and high:
                salary = f"${low:,} - ${high:,}"
            elif low:
                salary = f"${low:,}+"
            else:
                salary = ""
        else:
            salary = _clean(str(salary))

        description = re.sub(
            r"<[^>]+>", " ",
            str(raw.get("description") or raw.get("job_description") or ""),
        )

        apply_url = (
            raw.get("apply_url")
            or raw.get("applyUrl")
            or raw.get("url")
            or raw.get("job_url")
            or ""
        )
        if apply_url and not str(apply_url).startswith("http"):
            apply_url = urljoin(BASE, str(apply_url))

        commitment = str(
            raw.get("commitment_type") or raw.get("commitmentType") or "full-time"
        ).lower()
        job_type = "internship" if "intern" in commitment else "full-time"

        posted_date = str(
            raw.get("posted_date")
            or raw.get("date_fetched")
            or raw.get("createdAt")
            or ""
        )

        return {
            "title": title,
            "company": company_name,
            "location": location,
            "type": job_type,
            "salary": salary,
            "description": _clean(description),
            "skills": raw.get("skills", []) if isinstance(raw.get("skills"), list) else [],
            "apply_url": apply_url,
            "posted_date": posted_date,
            "is_remote": is_remote,
            "country": "Worldwide",
        }


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _find_job_like_dicts(data, _depth: int = 0) -> List[dict]:
    """
    Walk an arbitrary JSON structure (Next.js page props, intercepted API
    response, etc.) and collect dicts that look like individual job
    records, without assuming a fixed schema — HiringCafe's payload shape
    isn't publicly documented and may change without notice.
    """
    if _depth > 12:
        return []

    found = []

    if isinstance(data, dict):
        title_keys = {"title", "job_title", "jobTitle", "role_title"}
        support_keys = {
            "company", "company_name", "employer", "location",
            "formatted_location", "salary", "compensation",
            "description", "job_description", "apply_url", "applyUrl",
        }
        has_title = any(
            _clean(str(data.get(k) or "")) for k in title_keys
        )
        has_support = any(k in data for k in support_keys)

        if has_title and has_support:
            found.append(data)

        for value in data.values():
            found.extend(_find_job_like_dicts(value, _depth + 1))

    elif isinstance(data, list):
        for item in data:
            found.extend(_find_job_like_dicts(item, _depth + 1))

    return found


def _clean(text) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()
