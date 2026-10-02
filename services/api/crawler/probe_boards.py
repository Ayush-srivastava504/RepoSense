"""Ground-truth check for every candidate career board. Needs internet (run on EC2), no DB.

    cd services/api/crawler && python probe_boards.py            # all providers
    python probe_boards.py greenhouse lever                       # only some

Prints, per board: HTTP status, total jobs, jobs mentioning India. Boards marked MISSING 404'd: delete them
from src/ats_candidates.py (or leave them - they cost one request each).
"""
import re
import sys
import time

import requests

sys.path.insert(0, 'src')
from ats_candidates import CANDIDATE_ATS, WORKDAY_TENANTS  # noqa: E402

URLS = {
    'greenhouse': ('https://boards-api.greenhouse.io/v1/boards/{t}/jobs', 'jobs'),
    'lever': ('https://api.lever.co/v0/postings/{t}?mode=json', None),
    'ashby': ('https://api.ashbyhq.com/posting-api/job-board/{t}', 'jobs'),
    'smartrecruiters': ('https://api.smartrecruiters.com/v1/companies/{t}/postings?limit=100', 'content'),
    'workable': ('https://apply.workable.com/api/v1/widget/accounts/{t}', 'jobs'),
}
S = requests.Session()
S.headers['User-Agent'] = 'Mozilla/5.0 InternFlow-probe'


def india(items):
    return sum(1 for i in items if re.search(r'india|bengaluru|bangalore|mumbai|delhi|gurgaon|gurugram|hyderabad|pune|chennai|noida', str(i)[:600], re.I))


def probe(provider, token):
    url, key = URLS[provider]
    try:
        r = S.get(url.format(t=token), timeout=25)
    except Exception as exc:
        return 'ERR', 0, 0, str(exc)[:40]
    if r.status_code != 200:
        return r.status_code, 0, 0, 'MISSING' if r.status_code == 404 else ''
    try:
        data = r.json()
    except ValueError:
        return r.status_code, 0, 0, 'not json'
    items = data if key is None else (data.get(key) if isinstance(data, dict) else None) or []
    return 200, len(items), india(items), ''


def main(only):
    live = {}
    for provider, tokens in CANDIDATE_ATS.items():
        if only and provider not in only:
            continue
        print(f'\n== {provider}')
        for t in tokens:
            status, total, ind, note = probe(provider, t)
            print(f'  {t:<22} {status!s:<5} jobs={total:<5} india={ind:<4} {note}')
            if status == 200 and total:
                live.setdefault(provider, []).append(t)
            time.sleep(0.3)
    if not only or 'workday' in only:
        print('\n== workday')
        for w in WORKDAY_TENANTS:
            url = f"https://{w['host']}/wday/cxs/{w['tenant']}/{w['site']}/jobs"
            try:
                r = S.post(url, json={'limit': 5, 'offset': 0, 'searchText': 'intern india'}, timeout=25)
                total = r.json().get('total', '?') if r.status_code == 200 else '-'
                print(f"  {w['company']:<12} {w['site']:<28} {r.status_code} total={total}")
            except Exception as exc:
                print(f"  {w['company']:<12} {w['site']:<28} ERR {str(exc)[:40]}")
    print('\nLive boards:', {k: v for k, v in live.items()})


if __name__ == '__main__':
    main(set(sys.argv[1:]))
