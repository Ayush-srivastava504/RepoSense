import json
import os
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

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

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        jobs: List[Dict] = []

        keyword_pairs = [
            ("fresher jobs", "India"),
            ("internship", "India"),
            (
                "entry level software engineer",
                "India",
            ),
        ]

        for keyword, location in keyword_pairs:

            for page in range(1, max_pages + 1):

                batch = self._search(
                    keyword,
                    location,
                    page,
                )

                if not batch:
                    break

                jobs.extend(batch)

                self.log.info(
                    "Naukri kw=%r page=%d -> %d results",
                    keyword,
                    page,
                    len(batch),
                )

        self.log.info(
            "Collected %d jobs from naukri",
            len(jobs),
        )

        return jobs

    def _search(
        self,
        keyword: str,
        location: str,
        page: int,
    ) -> List[Dict]:

        params = {
            "noOfResults": 20,
            "urlType": "search_by_keyword",
            "searchType": "adv",
            "keyword": keyword,
            "location": location,
            "pageNo": page,
            "k": keyword,
            "l": location,
            "seoKey": (
                f"{keyword.replace(' ', '-')}-jobs"
            ),
            "src": "jobsearchDesk",
            "latLong": "",
        }

        response = safe_get(
            self.session,
            SEARCH_API,
            params=params,
            headers=HEADERS,
            domain_key="naukri",
        )

        if response:

            try:

                data = response.json()

                raw_jobs = (
                    data.get("jobDetails", [])
                    or data.get("jobs", [])
                )

                parsed = [
                    job
                    for job in (
                        self._parse_api(raw)
                        for raw in raw_jobs
                    )
                    if job
                ]

                if parsed:
                    return parsed

            except Exception:
                pass

        return self._scrape_html(
            keyword,
            location,
            page,
        )

    def _parse_api(
        self,
        raw: Dict,
    ) -> Optional[Dict]:

        job = self._empty_job()

        job["title"] = _clean(
            raw.get("title", "")
        )

        job["company"] = _clean(
            raw.get("companyName", "")
        )

        placeholders = raw.get(
            "placeholders",
            {},
        )

        if isinstance(placeholders, dict):

            job["location"] = ", ".join(
                placeholders.get(
                    "location",
                    "",
                ).split(",")[:3]
            )

        else:

            job["location"] = raw.get(
                "location",
                "",
            )

        job["salary"] = raw.get(
            "salary",
            "",
        )

        job["experience_required"] = raw.get(
            "experienceText",
            "",
        )

        job["description"] = _clean(
            raw.get("jobDescription", "")
        )

        if raw.get("tagsAndSkills"):

            skills = raw.get(
                "tagsAndSkills",
                "",
            ).split(",")

            job["skills"] = [
                skill.strip()
                for skill in skills
                if skill.strip()
            ]

        else:

            job["skills"] = []

        job["posted_date"] = str(
            raw.get(
                "footerPlaceholderLabel",
                "",
            )
        )

        job["type"] = _infer_type(
            job["title"]
            + " "
            + job.get(
                "experience_required",
                "",
            )
        )

        job["is_remote"] = (
            "remote"
            in job["location"].lower()
        )

        apply_url = raw.get(
            "jdURL",
            "",
        )

        if (
            apply_url
            and not apply_url.startswith("http")
        ):

            apply_url = urljoin(
                BASE,
                apply_url,
            )

        job["apply_url"] = apply_url

        return (
            job
            if job["title"]
            else None
        )

    def _scrape_html(
        self,
        keyword: str,
        location: str,
        page: int,
    ) -> List[Dict]:

        slug = (
            f"{keyword.replace(' ', '-')}"
            f"-jobs-in-"
            f"{location.replace(' ', '-').lower()}"
        )

        url = f"{BASE}/{slug}-{page}"

        self.log.info(
            "Naukri Playwright scrape: %s",
            url,
        )

        try:

            with sync_playwright() as p:

                browser = p.chromium.launch(
                    headless=True,
                )

                context = browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 "
                        "(Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 "
                        "(KHTML, like Gecko) "
                        "Chrome/124.0.0.0 "
                        "Safari/537.36"
                    )
                )

                page_obj = context.new_page()

                page_obj.goto(
                    url,
                    wait_until="networkidle",
                    timeout=60000,
                )

                page_obj.wait_for_timeout(5000)

                html = page_obj.content()

                browser.close()

        except Exception as e:

            self.log.warning(
                "Naukri Playwright error: %s",
                str(e),
            )

            return []

        # BUG FIX: was writing HTML to disk unconditionally, filling
        # Lambda's /tmp (512 MB). Now guarded by SCRAPER_DEBUG env var.
        if os.getenv("SCRAPER_DEBUG"):
            with open(
                "naukri_debug.html",
                "w",
                encoding="utf-8",
            ) as f:
                f.write(html)

        soup = BeautifulSoup(
            html,
            "html.parser",
        )

        selectors = [
            "article.jobTuple",
            ".cust-job-tuple",
            ".srp-jobtuple-wrapper",
            '[class*="jobTuple"]',
            '[class*="cust-job"]',
        ]

        cards = []

        for selector in selectors:

            cards = soup.select(selector)

            if cards:
                break

        self.log.info(
            "Naukri found %d cards",
            len(cards),
        )

        results = []

        for card in cards:

            try:

                job = self._empty_job()

                title_el = (
                    card.select_one("a.title")
                    or card.select_one("h2")
                    or card.select_one("a")
                )

                company_el = (
                    card.select_one(
                        ".company-name"
                    )
                    or card.select_one(
                        ".comp-name"
                    )
                    or card.select_one("h3")
                )

                location_el = (
                    card.select_one(".loc")
                    or card.select_one(".location")
                )

                salary_el = (
                    card.select_one(".salary")
                )

                exp_el = (
                    card.select_one(".experience")
                )

                link_el = card.select_one("a")

                job["title"] = _clean(
                    title_el.get_text(strip=True)
                    if title_el
                    else ""
                )

                if not job["title"]:
                    continue

                job["company"] = _clean(
                    company_el.get_text(strip=True)
                    if company_el
                    else ""
                )

                job["location"] = _clean(
                    location_el.get_text(strip=True)
                    if location_el
                    else ""
                )

                job["salary"] = _clean(
                    salary_el.get_text(strip=True)
                    if salary_el
                    else ""
                )

                job["experience_required"] = _clean(
                    exp_el.get_text(strip=True)
                    if exp_el
                    else ""
                )

                job["description"] = _clean(
                    card.get_text(
                        " ",
                        strip=True,
                    )
                )

                job["skills"] = []

                job["posted_date"] = ""

                job["type"] = _infer_type(
                    job["title"]
                    + " "
                    + job["experience_required"]
                )

                job["is_remote"] = (
                    "remote"
                    in job["location"].lower()
                )

                href = (
                    link_el.get("href")
                    if link_el
                    else ""
                )

                if href:

                    if href.startswith("http"):

                        job["apply_url"] = href

                    else:

                        job["apply_url"] = (
                            urljoin(BASE, href)
                        )

                else:

                    job["apply_url"] = ""

                results.append(job)

            except Exception:
                continue

        for script in soup.select(
            'script[type="application/ld+json"]'
        ):

            try:

                json_ld = json.loads(
                    script.string
                )

                if json_ld.get("@type") == "JobPosting":

                    job = self._parse_jsonld(
                        json_ld
                    )

                    if job:
                        results.append(job)

            except Exception:
                pass

        return results

    def _parse_jsonld(
        self,
        json_ld: Dict,
    ) -> Optional[Dict]:

        job = self._empty_job()

        job["title"] = _clean(
            json_ld.get("title", "")
        )

        job["company"] = _clean(
            json_ld.get(
                "hiringOrganization",
                {},
            ).get("name", "")
        )

        job["location"] = _clean(
            json_ld.get(
                "jobLocation",
                {},
            ).get(
                "address",
                {},
            ).get(
                "addressLocality",
                "",
            )
        )

        job["salary"] = str(
            json_ld.get(
                "baseSalary",
                "",
            )
        )

        description = re.sub(
            r"<[^>]+>",
            " ",
            json_ld.get(
                "description",
                "",
            ),
        )

        job["description"] = _clean(
            description
        )

        job["posted_date"] = json_ld.get(
            "datePosted",
            "",
        )

        job["type"] = _map_employment_type(
            json_ld.get(
                "employmentType",
                "",
            )
        )

        job["apply_url"] = json_ld.get(
            "url",
            "",
        )

        return (
            job
            if job["title"]
            else None
        )


def _clean(text: str) -> str:

    return re.sub(
        r"\s+",
        " ",
        text or "",
    ).strip()


def _text(
    soup,
    selector: str,
) -> str:

    element = soup.select_one(selector)

    return (
        _clean(element.get_text())
        if element
        else ""
    )


def _infer_type(text: str) -> str:

    text = (text or "").lower()

    if "intern" in text:
        return "internship"

    if (
        "0 year" in text
        or "fresher" in text
    ):
        return "full-time"

    return "full-time"


def _map_employment_type(
    employment_type: str,
) -> str:

    mapping = {
        "FULL_TIME": "full-time",
        "PART_TIME": "part-time",
        "INTERN": "internship",
        "TEMPORARY": "contract",
        "CONTRACTOR": "contract",
    }

    return mapping.get(
        (employment_type or "").upper(),
        "full-time",
    )