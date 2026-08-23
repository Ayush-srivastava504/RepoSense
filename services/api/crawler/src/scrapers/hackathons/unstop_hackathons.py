# Module: crawler/src/scrapers/hackathons/unstop_hackathons.py
# Defines class(es): UnstopHackathonScraper
# Defines function(s): url_fallback, _guess_themes, _clean
#

import os
import re
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
from scrapers.hackathons.base import BaseHackathonScraper
BASE = 'https://unstop.com'

class UnstopHackathonScraper(BaseHackathonScraper):
    source_name = 'unstop_hackathons'

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        results: List[Dict] = []
        for page_num in range(1, 3):
            url = f'{BASE}/hackathons?page={page_num}'
            self.log.info('Scraping Unstop hackathons: %s', url)
            try:
                html = self._render_page(url)
            except Exception as e:
                self.log.warning('Unstop hackathons render error: %s', str(e))
                continue
            if os.getenv('SCRAPER_DEBUG'):
                with open(f'unstop_hackathons_{page_num}.html', 'w', encoding='utf-8') as f:
                    f.write(html)
            soup = BeautifulSoup(html, 'html.parser')
            selectors = ['[class*="opportunity"]', '[class*="card"]', 'article', '.single_profile']
            cards = []
            for selector in selectors:
                cards = soup.select(selector)
                if cards:
                    break
            self.log.info('Found %d hackathon cards on Unstop', len(cards))
            if not cards:
                continue
            for card in cards:
                try:
                    h = self._parse_card(card)
                    if h:
                        results.append(h)
                except Exception:
                    continue
        self.log.info('Collected %d hackathons from unstop', len(results))
        return results

    def _render_page(self, url: str) -> str:
        page = self.new_page()
        try:
            page.goto(url, wait_until='networkidle', timeout=60000)
            page.wait_for_timeout(5000)
            return page.content()
        finally:
            page.context.close()

    def _parse_card(self, card) -> Optional[Dict]:
        title_el = card.select_one('h2') or card.select_one('h3') or card.select_one('a')
        if not title_el:
            return None
        title = _clean(title_el.get_text(strip=True))
        if not title:
            return None
        organizer_el = card.select_one('[class*="organi"]') or card.select_one('[class*="company"]')
        link_el = card.select_one('a')
        text = _clean(card.get_text(' ', strip=True))
        h = self._empty_hackathon()
        h['title'] = title
        h['organizer'] = _clean(organizer_el.get_text(strip=True)) if organizer_el else None
        h['description'] = text
        h['participation_mode'] = 'online' if 'online' in text.lower() else None
        h['is_global'] = 'worldwide' in text.lower() or 'global' in text.lower()
        h['is_student_friendly'] = 'student' in text.lower()
        prize_match = re.search('(₹|\\$)\\s?[\\d,]+(\\.\\d+)?\\s?(lakh|k|cr)?', text, re.IGNORECASE)
        h['prize_pool_text'] = prize_match.group(0) if prize_match else None
        deadline_match = re.search('(\\d+\\s?(days|hrs|hours)\\s?(left|to go))', text, re.IGNORECASE)
        h['registration_deadline'] = deadline_match.group(0) if deadline_match else None
        h['themes'] = _guess_themes(text)
        href = link_el.get('href') if link_el else ''
        if href:
            source_url = href if href.startswith('http') else BASE + href
        else:
            source_url = url_fallback(BASE, title)
        h['source_url'] = source_url
        h['apply_url'] = source_url
        h['source'] = self.source_name
        return h

def url_fallback(base: str, title: str) -> str:
    slug = re.sub('[^a-z0-9]+', '-', title.lower()).strip('-')
    return f'{base}/hackathons#{slug}'
THEME_KEYWORDS = ['ai', 'machine learning', 'ml', 'web3', 'blockchain', 'open source', 'healthcare', 'fintech', 'climate', 'sustainability', 'iot', 'cybersecurity', 'developer tools', 'gaming', 'edtech', 'robotics']

def _guess_themes(text: str) -> List[str]:
    lower = text.lower()
    return [kw.title() for kw in THEME_KEYWORDS if kw in lower][:6]

def _clean(text) -> str:
    return re.sub('\\s+', ' ', str(text or '')).strip()
