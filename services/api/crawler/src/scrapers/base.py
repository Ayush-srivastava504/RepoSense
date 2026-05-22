from abc import ABC, abstractmethod
from typing import Dict, List, Optional

from utils import (
    get_logger,
    make_session,
    make_job_id,
    utcnow,
)


class BaseScraper(ABC):

    source_name: str = "base"

    def __init__(self):
        self.session = make_session()
        self.log = get_logger(self.__class__.__name__)

    def run(
        self,
        keywords: Optional[List[str]] = None,
        locations: Optional[List[str]] = None,
        max_pages: int = 10,
    ) -> List[Dict]:

        self.log.info(
            "Starting %s scraper",
            self.source_name,
        )

        try:
            jobs = self.scrape(
                keywords=keywords or [],
                locations=locations or [],
                max_pages=max_pages,
            )

        except Exception as exc:

            self.log.error(
                "Scraper %s crashed: %s",
                self.source_name,
                exc,
                exc_info=True,
            )

            jobs = []

        for job in jobs:

            job.setdefault(
                "source",
                self.source_name,
            )

            job.setdefault(
                "scraped_at",
                utcnow(),
            )

            if not job.get("id"):

                job["id"] = make_job_id(
                    job.get("title", ""),
                    job.get("company", ""),
                    self.source_name,
                    job.get("apply_url", ""),
                )

        self.log.info(
            "Collected %d jobs from %s",
            len(jobs),
            self.source_name,
        )

        return jobs

    @abstractmethod
    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:
        ...

    @staticmethod
    def _empty_job() -> Dict:

        return {
            "id": None,
            "title": None,
            "company": None,
            "location": None,
            "type": None,
            "duration": None,
            "stipend": None,
            "salary": None,
            "description": None,
            "requirements": [],
            "skills": [],
            "apply_url": None,
            "source": None,
            "posted_date": None,
            "deadline": None,
            "is_remote": False,
            "experience_required": None,
            "scraped_at": None,
        }