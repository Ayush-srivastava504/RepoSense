from abc import abstractmethod
from typing import Dict, List

# Reuse the exact same browser lifecycle (Playwright launch/close, rate
# limiting, retry session) as the job scrapers — only the shape of the
# returned records differs.
from scrapers.base import BaseScraper


class BaseHackathonScraper(BaseScraper):
    """Same run()/new_page() machinery as BaseScraper, but scrape() returns
    hackathon records instead of job records, and run() doesn't force
    keywords/locations onto the call signature."""

    def run(self) -> List[Dict]:  # type: ignore[override]
        return super().run(keywords=[], locations=[], max_pages=1)

    @abstractmethod
    def scrape(  # type: ignore[override]
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:
        ...

    @staticmethod
    def _empty_hackathon() -> Dict:
        return {
            "title": None,
            "organizer": None,
            "description": None,
            "participation_mode": None,   # online | offline | hybrid
            "location": None,
            "country": None,
            "is_global": False,
            "is_student_friendly": False,
            "start_date": None,
            "end_date": None,
            "registration_deadline": None,
            "prize_pool_text": None,
            "prize_value_usd": None,
            "team_size_min": None,
            "team_size_max": None,
            "eligibility": None,
            "themes": [],
            "submission_requirements": [],
            "source": None,
            "source_url": None,
            "apply_url": None,
            "image_url": None,
        }
