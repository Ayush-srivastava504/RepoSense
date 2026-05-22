import json
import os
import random
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from scrapers.base import BaseScraper
from config import COMPANY_PORTALS
from utils import safe_get


class CompanyPortalsScraper(BaseScraper):

    source_name = "company_portals"

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        all_jobs: List[Dict] = []

        for (
            company_key,
            portal_config,
        ) in COMPANY_PORTALS.items():

            self.log.info(
                "Scraping company portal: %s",
                portal_config["name"],
            )

            try:

                strategy = portal_config.get(
                    "type",
                    "html",
                )

                if strategy == "api":

                    jobs = self._scrape_api_portal(
                        company_key,
                        portal_config,
                        max_pages,
                    )

                else:

                    jobs = self._scrape_html_portal(
                        company_key,
                        portal_config,
                        max_pages,
                    )

                all_jobs.extend(jobs)

                self.log.info(
                    "%s -> %d listings",
                    portal_config["name"],
                    len(jobs),
                )

            except Exception as exc:

                self.log.error(
                    "Company portal %s failed: %s",
                    company_key,
                    exc,
                    exc_info=True,
                )

            time.sleep(
                random.uniform(2, 5)
            )

        self.log.info(
            "Collected %d jobs from company portals",
            len(all_jobs),
        )

        return all_jobs

    def _scrape_html_portal(
        self,
        company_key: str,
        config: Dict,
        max_pages: int,
    ) -> List[Dict]:

        results = []

        base_url = config.get(
            "jobs_url",
            config.get(
                "base_url",
                "",
            ),
        )

        selectors = config.get(
            "selectors",
            {},
        )

        params = config.get(
            "params",
            {},
        )

        for page in range(
            1,
            min(max_pages, 5) + 1,
        ):

            page_params = {
                **params,
                "page": page,
            }

            try:

                html = self._render_page(
                    base_url,
                    page_params,
                )

            except Exception as e:

                self.log.warning(
                    "%s render failed: %s",
                    config["name"],
                    str(e),
                )

                continue

            # Write debug HTML only if SCRAPER_DEBUG is enabled
            if os.getenv("SCRAPER_DEBUG"):
                with open(
                    f"{company_key}_debug_{page}.html",
                    "w",
                    encoding="utf-8",
                ) as f:
                    f.write(html)

            soup = BeautifulSoup(
                html,
                "html.parser",
            )

            card_selector = selectors.get(
                "job_cards",
                (
                    "article, "
                    ".job-card, "
                    ".opening, "
                    ".job, "
                    '[class*="job"]'
                ),
            )

            cards = soup.select(
                card_selector
            )

            self.log.info(
                "%s found %d cards",
                config["name"],
                len(cards),
            )

            if not cards:

                jsonld_jobs = self._extract_jsonld_jobs(
                    soup,
                    config,
                )

                if jsonld_jobs:

                    results.extend(
                        jsonld_jobs
                    )

                continue

            for card in cards:

                try:

                    job = self._parse_html_card(
                        card,
                        config,
                        selectors,
                    )

                    if job:
                        results.append(job)

                except Exception:
                    continue

            if len(cards) < 3:
                break

        return results

    def _render_page(
        self,
        url: str,
        params: Dict,
    ) -> str:

        if params:

            query = "&".join(
                f"{k}={v}"
                for k, v in params.items()
            )

            final_url = (
                f"{url}?{query}"
            )

        else:

            final_url = url

        with sync_playwright() as p:

            browser = p.chromium.launch(
                headless=True,
            )

            context = browser.new_context(
                viewport={
                    "width": 1440,
                    "height": 900,
                },
                user_agent=(
                    "Mozilla/5.0 "
                    "(Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 "
                    "(KHTML, like Gecko) "
                    "Chrome/124.0.0.0 "
                    "Safari/537.36"
                ),
            )

            page = context.new_page()

            page.goto(
                final_url,
                wait_until="domcontentloaded",
                timeout=60000,
            )

            page.wait_for_timeout(8000)

            try:

                for _ in range(4):

                    page.mouse.wheel(0, 3500)

                    page.wait_for_timeout(
                        random.randint(1000, 2500)
                    )

            except Exception:
                pass

            html = page.content()

            browser.close()

            return html

    def _extract_jsonld_jobs(
        self,
        soup,
        config,
    ) -> List[Dict]:

        results = []

        for script in soup.select(
            'script[type="application/ld+json"]'
        ):

            try:

                json_ld = json.loads(
                    script.string or ""
                )

                if isinstance(
                    json_ld,
                    list,
                ):

                    for item in json_ld:

                        if (
                            item.get("@type")
                            == "JobPosting"
                        ):

                            job = self._parse_jsonld(
                                item,
                                config,
                            )

                            if job:
                                results.append(job)

                elif (
                    json_ld.get("@type")
                    == "JobPosting"
                ):

                    job = self._parse_jsonld(
                        json_ld,
                        config,
                    )

                    if job:
                        results.append(job)

            except Exception:
                pass

        return results

    def _parse_html_card(
        self,
        card,
        config: Dict,
        selectors: Dict,
    ) -> Optional[Dict]:

        job = self._empty_job()

        job["company"] = config["name"]

        job["source"] = (
            "company_portal_"
            f"{config['name'].lower().replace(' ', '_')}"
        )

        title_selectors = [
            selectors.get(
                "title",
                "",
            ),
            "h2",
            "h3",
            ".title",
            "a",
        ]

        title = ""

        for selector in title_selectors:

            if not selector:
                continue

            el = card.select_one(selector)

            if el:

                title = _clean(
                    el.get_text(
                        " ",
                        strip=True,
                    )
                )

                if title:
                    break

        if not title:
            return None

        job["title"] = title

        job["location"] = _text(
            card,
            selectors.get(
                "location",
                ".location",
            ),
        )

        job["salary"] = _text(
            card,
            selectors.get(
                "salary",
                ".salary",
            ),
        )

        job["stipend"] = job["salary"]

        job["duration"] = _text(
            card,
            selectors.get(
                "duration",
                ".duration",
            ),
        )

        job["description"] = _clean(
            card.get_text(
                " ",
                strip=True,
            )
        )

        link = card.select_one("a[href]")

        if link:

            href = link.get(
                "href",
                "",
            )

            job["apply_url"] = (
                urljoin(
                    config.get(
                        "base_url",
                        "",
                    ),
                    href,
                )
            )

        else:

            job["apply_url"] = ""

        job["type"] = _infer_type(
            job["title"]
        )

        job["is_remote"] = (
            "remote"
            in job["location"].lower()
        )

        return job

    def _parse_jsonld(
        self,
        json_ld: Dict,
        config: Dict,
    ) -> Optional[Dict]:

        job = self._empty_job()

        job["company"] = config["name"]

        job["source"] = (
            "company_portal_"
            f"{config['name'].lower().replace(' ', '_')}"
        )

        job["title"] = _clean(
            json_ld.get(
                "title",
                "",
            )
        )

        job_location = json_ld.get(
            "jobLocation"
        )

        if isinstance(
            job_location,
            dict,
        ):

            job["location"] = _clean(
                job_location.get(
                    "address",
                    {},
                ).get(
                    "addressLocality",
                    "",
                )
            )

        else:

            job["location"] = _clean(
                str(job_location or "")
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

        job["deadline"] = json_ld.get(
            "validThrough",
            "",
        )

        job["salary"] = _salary_from_jsonld(
            json_ld.get(
                "baseSalary",
                {},
            )
        )

        job["type"] = _map_employment_type(
            json_ld.get(
                "employmentType",
                "",
            )
        )

        job["apply_url"] = (
            json_ld.get("url", "")
            or json_ld.get(
                "apply",
                {},
            ).get(
                "url",
                "",
            )
        )

        job["is_remote"] = (
            "remote"
            in job["location"].lower()
        )

        return (
            job
            if job["title"]
            else None
        )

    def _scrape_api_portal(
        self,
        company_key: str,
        config: Dict,
        max_pages: int,
    ) -> List[Dict]:

        results = []

        api_url = config.get(
            "api_url",
            "",
        )

        api_params = dict(
            config.get(
                "api_params",
                {},
            )
        )

        for page in range(
            1,
            min(max_pages, 5) + 1,
        ):

            api_params["page"] = page

            response = safe_get(
                self.session,
                api_url,
                params=api_params,
                domain_key=company_key,
            )

            if not response:
                break

            try:

                data = response.json()

            except Exception:
                break

            items = _extract_items(data)

            if not items:
                break

            for raw in items:

                job = self._parse_api_item(
                    raw,
                    config,
                )

                if job:
                    results.append(job)

        return results

    def _parse_api_item(
        self,
        raw: Dict,
        config: Dict,
    ) -> Optional[Dict]:

        job = self._empty_job()

        job["company"] = config["name"]

        job["source"] = (
            "company_portal_"
            f"{config['name'].lower().replace(' ', '_')}"
        )

        job["title"] = _clean(
            raw.get("title", "")
            or raw.get("name", "")
            or raw.get(
                "jobTitle",
                "",
            )
        )

        if not job["title"]:
            return None

        job["location"] = _clean(
            raw.get("location", "")
            or raw.get("city", "")
            or raw.get(
                "locationName",
                "",
            )
            or raw.get(
                "primaryLocation",
                "",
            )
        )

        description = re.sub(
            r"<[^>]+>",
            " ",
            str(
                raw.get(
                    "description",
                    "",
                )
                or ""
            ),
        )

        job["description"] = _clean(
            description
        )

        job["salary"] = str(
            raw.get("salary", "")
            or raw.get("ctc", "")
            or ""
        )

        job["apply_url"] = (
            raw.get("url", "")
            or raw.get(
                "apply_url",
                "",
            )
            or raw.get(
                "jobUrl",
                "",
            )
            or raw.get(
                "applyURL",
                "",
            )
        )

        job["posted_date"] = str(
            raw.get(
                "postedDate",
                "",
            )
            or raw.get(
                "created_at",
                "",
            )
            or ""
        )

        job["type"] = _infer_type(
            job["title"]
        )

        job["is_remote"] = (
            "remote"
            in job["location"].lower()
        )

        return job


def _clean(text) -> str:

    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
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


def _infer_type(
    title: str,
) -> str:

    title = (title or "").lower()

    if "intern" in title:
        return "internship"

    if (
        "trainee" in title
        or "fresher" in title
    ):
        return "full-time"

    return "full-time"


def _map_employment_type(
    employment_type: str,
) -> str:

    mapping = {
        "FULL_TIME": "full-time",
        "Full-Time": "full-time",
        "Internship": "internship",
        "INTERN": "internship",
        "PART_TIME": "part-time",
        "TEMPORARY": "contract",
        "CONTRACT": "contract",
    }

    return mapping.get(
        employment_type,
        _infer_type(employment_type),
    )


def _salary_from_jsonld(
    base_salary,
) -> str:

    if (
        not base_salary
        or not isinstance(base_salary, dict)
    ):
        return ""

    value = base_salary.get(
        "value",
        {},
    )

    if isinstance(value, dict):

        minimum = value.get(
            "minValue",
            "",
        )

        maximum = value.get(
            "maxValue",
            "",
        )

        unit = value.get(
            "unitText",
            "",
        )

        currency = base_salary.get(
            "currency",
            "INR",
        )

        if minimum and maximum:

            return (
                f"{currency} "
                f"{minimum}-{maximum} "
                f"{unit}"
            )

        if minimum:

            return (
                f"{currency} "
                f"{minimum}+ "
                f"{unit}"
            )

    return str(base_salary)


def _extract_items(
    data,
) -> List[Dict]:

    if isinstance(data, list):
        return data

    if isinstance(data, dict):

        for key in (
            "jobs",
            "jobListings",
            "results",
            "data",
            "items",
            "postings",
            "elements",
        ):

            candidate = data.get(key)

            if isinstance(candidate, list):
                return candidate

            if isinstance(candidate, dict):

                for inner_key in (
                    "jobs",
                    "results",
                    "data",
                    "items",
                ):

                    inner = candidate.get(
                        inner_key
                    )

                    if isinstance(inner, list):
                        return inner

    return []