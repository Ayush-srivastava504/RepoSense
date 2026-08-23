# Module: crawler/src/scrapers/hackathons/devpost.py
# Defines class(es): DevpostScraper
# Defines function(s): _parse_submission_period, _parse_devpost_date
#

import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
from dateutil import parser as dateparser
from scrapers.hackathons.base import BaseHackathonScraper
API_URL = 'https://devpost.com/api/hackathons'

class DevpostScraper(BaseHackathonScraper):
    source_name = 'devpost'
    uses_browser = False

    def scrape(self, keywords: List[str], locations: List[str], max_pages: int) -> List[Dict]:
        results: List[Dict] = []
        pages = min(max_pages or 3, 3)
        for page_num in range(1, pages + 1):
            params = {'status[]': 'open', 'order_by': 'recently-added', 'page': page_num}
            self.log.info('Scraping Devpost page %d', page_num)
            try:
                response = self.session.get(API_URL, params=params, timeout=20)
                response.raise_for_status()
            except Exception as exc:
                self.log.warning('Devpost API error: %s', str(exc))
                continue
            try:
                data = response.json()
            except Exception:
                self.log.warning('Devpost API returned non-JSON')
                continue
            entries = data.get('hackathons', [])
            if not entries:
                break
            for entry in entries:
                hackathon = self._parse_entry(entry)
                if hackathon:
                    results.append(hackathon)
        self.log.info('Collected %d hackathons from devpost', len(results))
        return results

    def _parse_entry(self, entry: Dict) -> Optional[Dict]:
        title = (entry.get('title') or '').strip()
        if not title:
            return None
        url = (entry.get('url') or '').strip()
        if not url:
            return None
        hackathon = self._empty_hackathon()
        hackathon['title'] = title
        hackathon['organizer'] = entry.get('organization_name') or 'Devpost host'
        hackathon['description'] = entry.get('tagline') or entry.get('description') or ''
        displayed_location = entry.get('displayed_location') or {}
        location = displayed_location.get('location')
        hackathon['location'] = location
        hackathon['is_global'] = location in (None, 'Online', 'Worldwide')
        if location in (None, 'Online', 'Worldwide'):
            hackathon['participation_mode'] = 'online'
        prize_amount = entry.get('prize_amount')
        hackathon['prize_pool_text'] = prize_amount
        submission_period = entry.get('submission_period_dates')
        start_date, end_date = _parse_submission_period(submission_period)
        hackathon['start_date'] = start_date
        hackathon['end_date'] = end_date
        hackathon['registration_deadline'] = end_date
        hackathon['themes'] = [theme.get('name') for theme in entry.get('themes') or [] if theme.get('name')][:8]
        hackathon['source'] = self.source_name
        hackathon['source_url'] = url
        hackathon['apply_url'] = url
        hackathon['image_url'] = entry.get('thumbnail_url')
        return hackathon

def _parse_submission_period(value) -> tuple[Optional[str], Optional[str]]:
    if not value:
        return (None, None)
    text = str(value).strip()
    same_month_match = re.fullmatch('([A-Za-z]{3,9})\\s+(\\d{1,2})\\s*-\\s*(\\d{1,2}),\\s*(\\d{4})', text)
    if same_month_match:
        month = same_month_match.group(1)
        start_day = same_month_match.group(2)
        end_day = same_month_match.group(3)
        year = same_month_match.group(4)
        start_text = f'{month} {start_day}, {year}'
        end_text = f'{month} {end_day}, {year}'
        return (_parse_devpost_date(start_text), _parse_devpost_date(end_text))
    cross_month_match = re.fullmatch('([A-Za-z]{3,9})\\s+(\\d{1,2})\\s*-\\s*([A-Za-z]{3,9})\\s+(\\d{1,2}),\\s*(\\d{4})', text)
    if cross_month_match:
        start_month = cross_month_match.group(1)
        start_day = cross_month_match.group(2)
        end_month = cross_month_match.group(3)
        end_day = cross_month_match.group(4)
        year = cross_month_match.group(5)
        start_text = f'{start_month} {start_day}, {year}'
        end_text = f'{end_month} {end_day}, {year}'
        return (_parse_devpost_date(start_text), _parse_devpost_date(end_text))
    self_contained_date = _parse_devpost_date(text)
    return (None, self_contained_date)

def _parse_devpost_date(value: str) -> Optional[str]:
    try:
        parsed = dateparser.parse(value, fuzzy=False)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError, OverflowError):
        return None
