# Module: crawler/src/processors/hackathon_status.py
# Defines function(s): apply_status, determine_status, is_publicly_visible, _as_dt
#
#

from datetime import datetime, timezone
from typing import Dict, List, Optional
from dateutil import parser as dateparser

def apply_status(hackathons: List[Dict]) -> List[Dict]:
    for h in hackathons:
        h['status'] = determine_status(h)
    return hackathons

def determine_status(h: Dict) -> str:
    now = datetime.now(timezone.utc)
    start = _as_dt(h.get('start_date'))
    end = _as_dt(h.get('end_date'))
    deadline = _as_dt(h.get('registration_deadline'))
    if end and end < now:
        return 'ended'
    if start and end and (start <= now <= end):
        return 'ongoing'
    if deadline and deadline < now:
        return 'registration_closed'
    return 'upcoming'

def is_publicly_visible(status: str) -> bool:
    return status in ('upcoming', 'ongoing')

def _as_dt(value) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = dateparser.parse(str(value))
        if parsed and (not parsed.tzinfo):
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None
