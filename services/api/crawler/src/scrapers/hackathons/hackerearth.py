import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from scrapers.hackathons.base import BaseHackathonScraper


BASE_URL = "https://www.hackerearth.com"
LISTING_URL = (
    "https://www.hackerearth.com/"
    "challenges/hackathon/"
)


class HackerEarthScraper(
    BaseHackathonScraper
):

    source_name = "hackerearth"
    uses_browser = True

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        results: List[Dict] = []

        seen_urls = set()

        page = self.new_page()

        try:
            self.log.info(
                "Scraping HackerEarth hackathons"
            )

            page.goto(
                LISTING_URL,
                wait_until="domcontentloaded",
                timeout=60_000,
            )

            page.wait_for_timeout(
                4_000
            )

            for _ in range(5):

                page.mouse.wheel(
                    0,
                    3000,
                )

                page.wait_for_timeout(
                    800
                )

            links = page.locator(
                'a[href*="/challenges/hackathon/"]'
            )

            count = links.count()

            self.log.info(
                "Found %d HackerEarth links",
                count,
            )

            for index in range(count):

                try:
                    link = links.nth(
                        index
                    )

                    href = link.get_attribute(
                        "href"
                    )

                    if not href:
                        continue

                    url = urljoin(
                        BASE_URL,
                        href,
                    )

                    if (
                        url in seen_urls
                        or url.rstrip("/")
                        == LISTING_URL.rstrip("/")
                    ):
                        continue

                    text = (
                        link.inner_text()
                        or ""
                    ).strip()

                    if not text:
                        continue

                    seen_urls.add(url)

                    item = self._parse_card(
                        text,
                        url,
                    )

                    if item:
                        results.append(
                            item
                        )

                except Exception:
                    continue

        except Exception:
            self.log.exception(
                "Failed scraping HackerEarth"
            )

        finally:
            page.close()

        self.log.info(
            "Collected %d hackathons "
            "from hackerearth",
            len(results),
        )

        return results

    def _parse_card(
        self,
        text: str,
        url: str,
    ) -> Optional[Dict]:

        lines = [
            line.strip()
            for line in text.splitlines()
            if line.strip()
        ]

        if not lines:
            return None

        title = lines[0]

        if len(title) < 3:
            return None

        full_text = " ".join(lines)

        hackathon = self._empty_hackathon()

        hackathon["title"] = title

        hackathon["description"] = (
            full_text
        )

        hackathon["organizer"] = (
            _extract_organizer(full_text)
            or "HackerEarth host"
        )

        hackathon["participation_mode"] = (
            _extract_mode(full_text)
        )

        if (
            hackathon["participation_mode"]
            == "online"
        ):
            hackathon["location"] = (
                "Online"
            )

            hackathon["is_global"] = True

        hackathon["registration_deadline"] = (
            _extract_deadline(full_text)
        )

        hackathon["prize_pool_text"] = (
            _extract_prize(full_text)
        )

        hackathon["is_student_friendly"] = (
            _is_student_friendly(
                full_text
            )
        )

        hackathon["themes"] = (
            _extract_themes(full_text)
        )

        hackathon["source"] = (
            self.source_name
        )

        hackathon["source_url"] = url

        hackathon["apply_url"] = url

        return hackathon


def _extract_organizer(
    text: str,
) -> Optional[str]:

    match = re.search(
        (
            r"(?:conducted|organized|hosted)"
            r"\s+by\s+(.+?)"
            r"(?:\.|Showcase|Register|$)"
        ),
        text,
        re.IGNORECASE,
    )

    if match:
        return match.group(1).strip()

    return None


def _extract_mode(
    text: str,
) -> Optional[str]:

    text_lower = text.lower()

    if "hybrid" in text_lower:
        return "hybrid"

    if (
        "online" in text_lower
        or "virtual" in text_lower
        or "remote" in text_lower
    ):
        return "online"

    if (
        "offline" in text_lower
        or "in-person" in text_lower
        or "onsite" in text_lower
    ):
        return "offline"

    return None


def _extract_deadline(
    text: str,
) -> Optional[str]:

    patterns = (
        (
            r"(?:registration ends|"
            r"registration deadline|deadline)"
            r"\s*:?\s*"
            r"([A-Za-z]{3,9}\s+\d{1,2}"
            r"(?:,\s*\d{4})?)"
        ),
        (
            r"(\d+)\s+days?\s+left"
        ),
        (
            r"(\d+)\s+hours?\s+left"
        ),
    )

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.IGNORECASE,
        )

        if not match:
            continue

        value = match.group(0)

        deadline_prefix = re.sub(
            (
                r"^(registration ends|"
                r"registration deadline|"
                r"deadline)\s*:?\s*"
            ),
            "",
            value,
            flags=re.IGNORECASE,
        )

        return deadline_prefix.strip()

    return None


def _extract_prize(
    text: str,
) -> Optional[str]:

    match = re.search(
        (
            r"([₹$€£]\s*"
            r"[\d,]+(?:\.\d+)?"
            r"(?:\s*(?:k|lakh|cr))?)"
        ),
        text,
        re.IGNORECASE,
    )

    if match:
        return match.group(1)

    return None


def _is_student_friendly(
    text: str,
) -> bool:

    keywords = (
        "student",
        "college",
        "university",
        "undergraduate",
        "campus",
        "graduate",
    )

    text_lower = text.lower()

    return any(
        keyword in text_lower
        for keyword in keywords
    )


def _extract_themes(
    text: str,
) -> List[str]:

    theme_keywords = {
        "artificial intelligence": (
            "Artificial Intelligence"
        ),
        "machine learning": (
            "Machine Learning"
        ),
        "data science": "Data Science",
        "cloud": "Cloud",
        "cybersecurity": "Cybersecurity",
        "blockchain": "Blockchain",
        "web3": "Web3",
        "fintech": "FinTech",
        "healthcare": "HealthTech",
        "database": "Database",
    }

    text_lower = text.lower()

    themes = []

    for keyword, theme in (
        theme_keywords.items()
    ):

        if keyword in text_lower:
            themes.append(theme)

    return themes[:8]