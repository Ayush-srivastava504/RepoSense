# Module: crawler/src/scrapers/hackathons/devfolio.py
# Defines class(es): DevfolioScraper
# Defines function(s): _extract_location, _extract_runs_from, _extract_prize, _is_student_friendly, _extract_themes
#

import re
from typing import Dict, List, Optional
from urllib.parse import urljoin
from scrapers.hackathons.base import BaseHackathonScraper
BASE_URL = 'https://devfolio.co'
OPEN_URL = 'https://devfolio.co/hackathons/open'
UPCOMING_URL = 'https://devfolio.co/hackathons/upcoming'

class DevfolioScraper(BaseHackathonScraper):
    source_name = 'devfolio'
    uses_browser = True

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        results: List[Dict] = []
        seen_urls = set()
        for listing_url in (OPEN_URL, UPCOMING_URL):
            self.log.info('Scraping Devfolio: %s', listing_url)
            page = self.new_page()
            try:
                page.goto(listing_url, wait_until='domcontentloaded', timeout=60000)
                page.wait_for_timeout(4000)
                for _ in range(5):
                    page.mouse.wheel(0, 3000)
                    page.wait_for_timeout(800)
                links = page.locator('a[href*=".devfolio.co"]')
                count = links.count()
                self.log.info('Found %d Devfolio links', count)
                for index in range(count):
                    try:
                        link = links.nth(index)
                        href = link.get_attribute('href')
                        if not href:
                            continue
                        url = urljoin(BASE_URL, href)
                        if '.devfolio.co' not in url or url in seen_urls:
                            continue
                        text = (link.inner_text() or '').strip()
                        if not text:
                            continue
                        seen_urls.add(url)
                        item = self._parse_card(text, url)
                        if item:
                            results.append(item)
                    except Exception:
                        continue
            except Exception:
                self.log.exception('Failed scraping Devfolio listing')
            finally:
                page.close()
        self.log.info('Collected %d hackathons from devfolio', len(results))
        return results

    def _parse_card(self, text: str, url: str) -> Optional[Dict]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            return None
        title = lines[0]
        if len(title) < 3:
            return None
        full_text = ' '.join(lines)
        hackathon = self._empty_hackathon()
        hackathon['title'] = title
        hackathon['description'] = full_text
        hackathon['organizer'] = 'Devfolio host'
        location = _extract_location(full_text)
        hackathon['location'] = location
        if not location or location.lower() == 'online':
            hackathon['participation_mode'] = 'online'
            hackathon['is_global'] = True
        else:
            hackathon['participation_mode'] = 'offline'
        start_date, end_date = _extract_runs_from(full_text)
        hackathon['start_date'] = start_date
        hackathon['end_date'] = end_date
        hackathon['registration_deadline'] = end_date
        hackathon['prize_pool_text'] = _extract_prize(full_text)
        hackathon['is_student_friendly'] = _is_student_friendly(full_text)
        hackathon['themes'] = _extract_themes(full_text)
        hackathon['source'] = self.source_name
        hackathon['source_url'] = url
        hackathon['apply_url'] = url
        return hackathon

def _extract_location(text: str) -> Optional[str]:
    if re.search('\\bonline\\b', text, re.IGNORECASE):
        return 'Online'
    match = re.search('Happening\\s+(.+?)(?:Applications|Runs from|$)', text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return None

def _extract_runs_from(text: str) -> tuple[Optional[str], Optional[str]]:
    match = re.search('Runs from\\s+([A-Za-z]{3,9}\\s+\\d{1,2})\\s*-\\s*(?:(?:([A-Za-z]{3,9})\\s+)?(\\d{1,2})),\\s*(\\d{4})', text, re.IGNORECASE)
    if not match:
        return (None, None)
    start_text = match.group(1)
    start_month = start_text.split()[0]
    end_month = match.group(2) or start_month
    end_day = match.group(3)
    year = match.group(4)
    start_date = f'{start_text}, {year}'
    end_date = f'{end_month} {end_day}, {year}'
    return (start_date, end_date)

def _extract_prize(text: str) -> Optional[str]:
    match = re.search('([₹$€£]\\s*[\\d,]+(?:\\.\\d+)?(?:\\s*(?:k|lakh|cr))?)', text, re.IGNORECASE)
    if match:
        return match.group(1)
    return None

def _is_student_friendly(text: str) -> bool:
    keywords = ('student', 'college', 'university', 'undergraduate', 'campus')
    text_lower = text.lower()
    return any((keyword in text_lower for keyword in keywords))

def _extract_themes(text: str) -> List[str]:
    theme_keywords = {'ai': 'Artificial Intelligence', 'machine learning': 'Machine Learning', 'web3': 'Web3', 'blockchain': 'Blockchain', 'fintech': 'FinTech', 'health': 'HealthTech', 'climate': 'Climate', 'sustainability': 'Sustainability', 'developer tools': 'Developer Tools', 'open source': 'Open Source'}
    text_lower = text.lower()
    themes = []
    for keyword, theme in theme_keywords.items():
        if keyword in text_lower:
            themes.append(theme)
    return themes[:8]
