# Module: crawler/src/scrapers/hackathons/__init__ .py
# Defines class(es): BaseHackathonScraper
#
#

from abc import abstractmethod
from typing import Dict, List
from scrapers.base import BaseScraper

class BaseHackathonScraper(BaseScraper):

    def run(self) -> List[Dict]:
        return super().run(keywords=[], locations=[], max_pages=1)

    @abstractmethod
    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        ...

    @staticmethod
    def _empty_hackathon() -> Dict:
        return {'title': None, 'organizer': None, 'description': None, 'participation_mode': None, 'location': None, 'country': None, 'is_global': False, 'is_student_friendly': False, 'start_date': None, 'end_date': None, 'registration_deadline': None, 'prize_pool_text': None, 'prize_value_usd': None, 'team_size_min': None, 'team_size_max': None, 'eligibility': None, 'themes': [], 'submission_requirements': [], 'source': None, 'source_url': None, 'apply_url': None, 'image_url': None}
