import json
import os
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from scrapers.base import BaseScraper

BASE = "https://wellfound.com"

# Endpoint fragments that indicate an XHR/fetch response is likely to
# contain job-search data. Wellfound's front end is a Next.js app that
# talks to a GraphQL backend, so we watch for those calls while the page
# loads instead of relying on hashed CSS class names, which change on
# every deploy.
API_HINTS = (
    "graphql",
    "job_listings",
    "jobListings",
    "search",
    "startups",
)


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
                    # Don't keep paging a dead search — but don't kill
                    # the whole job_type either in case page 1 just had
                    # a transient render hiccup.
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

    # ------------------------------------------------------------------
    # Page fetch + multi-strategy extraction
    # ------------------------------------------------------------------

    def _fetch_page(
        self,
        keyword: str,
        locations: List[str],
        job_type: str,
        page: int,
    ) -> List[Dict]:

        query = keyword.replace(" ", "%20")
        url = f"{BASE}/jobs?q={query}&page={page}"

        captured_responses: List[dict] = []

        def handle_response(response):
            try:
                req_url = response.url
                if not any(hint in req_url for hint in API_HINTS):
                    return
                content_type = response.headers.get("content-type", "")
                if "json" not in content_type:
                    return
                data = response.json()
                captured_responses.append(data)
            except Exception:
                # Response wasn't JSON, already consumed, etc. — ignore,
                # this is a best-effort side channel, not the main path.
                pass

        try:
            page_obj = self.new_page()
        except Exception as e:
            self.log.warning("Wellfound browser launch error: %s", str(e))
            return []

        try:
            page_obj.on("response", handle_response)

            try:
                self.goto(page_obj, url)
            except Exception as e:
                self.log.warning("Wellfound navigation error: %s", str(e))
                return []

            page_obj.wait_for_timeout(5000)

            # Give lazy-loaded / infinite-scroll content a chance to fire
            # its data requests too.
            try:
                for _ in range(3):
                    page_obj.mouse.wheel(0, 3000)
                    page_obj.wait_for_timeout(1200)
            except Exception:
                pass

            final_url = page_obj.url
            title = page_obj.title()
            html = page_obj.content()

        finally:
            page_obj.context.close()

        if os.getenv("SCRAPER_DEBUG"):
            with open("wellfound_debug.html", "w", encoding="utf-8") as f:
                f.write(html)

        # Cheap sanity check: if we've been bounced to a login/auth wall,
        # every extraction strategy below will legitimately return 0 and
        # that's useful to know explicitly rather than silently retrying.
        lowered_title = (title or "").lower()
        if "login" in final_url.lower() or "sign in" in lowered_title:
            self.log.warning(
                "Wellfound redirected to a login/auth page (url=%s, title=%r) "
                "— job data is not accessible without authentication right now.",
                final_url,
                title,
            )
            return []

        soup = BeautifulSoup(html, "html.parser")

        # Strategy 1: Next.js hydration payload. Most reliable when present
        # because it's the actual data the page was built from, not a
        # visual representation of it.
        jobs = self._from_next_data(soup, job_type)
        if jobs:
            self.log.info("Wellfound: got %d jobs from __NEXT_DATA__", len(jobs))
            return jobs

        # Strategy 2: captured API/XHR responses.
        jobs = self._from_captured_responses(captured_responses, job_type)
        if jobs:
            self.log.info(
                "Wellfound: got %d jobs from intercepted network responses",
                len(jobs),
            )
            return jobs

        # Strategy 3: JSON-LD structured data, if the page embeds it.
        jobs = self._from_jsonld(soup, job_type)
        if jobs:
            self.log.info("Wellfound: got %d jobs from JSON-LD", len(jobs))
            return jobs

        # Strategy 4: structural HTML fallback — avoid hashed CSS module
        # classes entirely, key off semantic/structural markers instead.
        jobs = self._from_html_structure(soup, job_type)
        if jobs:
            self.log.info(
                "Wellfound: got %d jobs from structural HTML fallback",
                len(jobs),
            )
            return jobs

        # Nothing worked. Log enough context to diagnose *why* without
        # needing to babysit this next time.
        body_text = soup.get_text(" ", strip=True)[:300]
        self.log.warning(
            "Wellfound: 0 jobs from all strategies. url=%s title=%r "
            "captured_responses=%d body_snippet=%r",
            final_url,
            title,
            len(captured_responses),
            body_text,
        )
        return []

    # ------------------------------------------------------------------
    # Strategy 1: __NEXT_DATA__
    # ------------------------------------------------------------------

    def _from_next_data(self, soup, job_type: str) -> List[Dict]:
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return []

        try:
            data = json.loads(script.string)
        except Exception:
            return []

        candidates = _find_job_like_dicts(data)
        jobs = []
        for raw in candidates:
            job = self._normalize(raw, job_type)
            if job:
                jobs.append(job)
        return jobs

    # ------------------------------------------------------------------
    # Strategy 2: intercepted network responses
    # ------------------------------------------------------------------

    def _from_captured_responses(
        self, responses: List[dict], job_type: str
    ) -> List[Dict]:
        jobs = []
        for data in responses:
            for raw in _find_job_like_dicts(data):
                job = self._normalize(raw, job_type)
                if job:
                    jobs.append(job)
        return jobs

    # ------------------------------------------------------------------
    # Strategy 3: JSON-LD
    # ------------------------------------------------------------------

    def _from_jsonld(self, soup, job_type: str) -> List[Dict]:
        jobs = []
        for script in soup.select('script[type="application/ld+json"]'):
            try:
                parsed = json.loads(script.string or "")
            except Exception:
                continue

            items = parsed if isinstance(parsed, list) else [parsed]
            for item in items:
                if not isinstance(item, dict):
                    continue
                if item.get("@type") != "JobPosting":
                    continue

                job = self._empty_job()
                job["title"] = _clean(item.get("title", ""))
                if not job["title"]:
                    continue

                org = item.get("hiringOrganization", {})
                job["company"] = _clean(
                    org.get("name", "") if isinstance(org, dict) else str(org)
                )

                loc = item.get("jobLocation", {})
                if isinstance(loc, dict):
                    address = loc.get("address", {})
                    job["location"] = _clean(
                        address.get("addressLocality", "")
                        if isinstance(address, dict)
                        else ""
                    )
                else:
                    job["location"] = ""

                description = re.sub(r"<[^>]+>", " ", item.get("description", ""))
                job["description"] = _clean(description)
                job["posted_date"] = item.get("datePosted", "")
                job["type"] = job_type
                job["salary"] = ""
                job["skills"] = []
                job["is_remote"] = "remote" in job["location"].lower()
                job["apply_url"] = item.get("url", "")

                jobs.append(job)
        return jobs

    # ------------------------------------------------------------------
    # Strategy 4: structural HTML fallback
    # ------------------------------------------------------------------

    def _from_html_structure(self, soup, job_type: str) -> List[Dict]:
        # Anchors whose href points at an individual job/startup posting
        # are far more stable than any visual class name.
        link_pattern = re.compile(r"/(jobs|company|startups)/[^/?#]+")
        anchors = [
            a for a in soup.find_all("a", href=True) if link_pattern.search(a["href"])
        ]

        jobs = []
        seen_urls = set()

        for a in anchors:
            title = _clean(a.get_text(" ", strip=True))
            if not title or len(title) < 3:
                continue

            href = a["href"]
            apply_url = href if href.startswith("http") else urljoin(BASE, href)
            if apply_url in seen_urls:
                continue
            seen_urls.add(apply_url)

            # Look for a nearby heading/company hint by walking up to a
            # reasonably sized container and grabbing sibling text.
            container = a
            for _ in range(4):
                if container.parent:
                    container = container.parent
                if container and len(container.get_text(strip=True)) > len(title) + 5:
                    break

            job = self._empty_job()
            job["title"] = title
            job["company"] = ""
            job["location"] = ""
            job["salary"] = ""
            job["description"] = _clean(container.get_text(" ", strip=True))[:500]
            job["skills"] = []
            job["is_remote"] = "remote" in job["description"].lower()
            job["posted_date"] = ""
            job["type"] = job_type
            job["apply_url"] = apply_url

            jobs.append(job)

        return jobs

    # ------------------------------------------------------------------
    # Shared normalization for dict-shaped job records (Next.js / API)
    # ------------------------------------------------------------------

    def _normalize(self, raw: dict, job_type: str) -> Optional[Dict]:
        title = _clean(
            raw.get("title")
            or raw.get("jobTitle")
            or raw.get("name")
            or ""
        )
        if not title:
            return None

        job = self._empty_job()
        job["title"] = title

        company = raw.get("company") or raw.get("startup") or {}
        if isinstance(company, dict):
            job["company"] = _clean(company.get("name", ""))
        else:
            job["company"] = _clean(str(company))

        location = raw.get("location") or raw.get("locationName") or ""
        if isinstance(location, dict):
            location = location.get("name", "") or location.get("city", "")
        job["location"] = _clean(str(location))

        job["salary"] = _clean(
            str(raw.get("salary", "") or raw.get("compensation", ""))
        )
        job["description"] = _clean(
            re.sub(r"<[^>]+>", " ", str(raw.get("description", "") or ""))
        )
        job["skills"] = raw.get("skills", []) if isinstance(raw.get("skills"), list) else []
        job["posted_date"] = str(raw.get("postedDate", "") or raw.get("createdAt", ""))
        job["type"] = job_type
        job["is_remote"] = bool(raw.get("remote", False)) or (
            "remote" in job["location"].lower()
        )

        slug = raw.get("slug") or raw.get("id") or ""
        url = raw.get("url", "")
        if url:
            job["apply_url"] = url if str(url).startswith("http") else urljoin(BASE, str(url))
        elif slug:
            job["apply_url"] = urljoin(BASE, f"/jobs/{slug}")
        else:
            job["apply_url"] = ""

        return job

    def _parse(self, raw: Dict) -> Optional[Dict]:
        return raw


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _find_job_like_dicts(data, _depth: int = 0) -> List[dict]:
    """
    Walk an arbitrary JSON structure (Next.js page props, GraphQL response,
    etc.) and collect dicts that look like individual job records — i.e.
    they have a title-ish key plus at least one other job-ish key. This
    avoids hardcoding a specific schema path, which is exactly the kind of
    thing that breaks silently when the front end changes.
    """
    if _depth > 12:
        return []

    found = []

    if isinstance(data, dict):
        title_keys = {"title", "jobTitle"}
        support_keys = {
            "company", "startup", "location", "locationName",
            "salary", "compensation", "description", "slug",
        }
        has_title = any(k in data for k in title_keys) and _clean(
            str(data.get("title") or data.get("jobTitle") or "")
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
    return re.sub(r"\s+", " ", str(text or "")).strip()