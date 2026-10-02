# Pushes new / changed / removed URLs from the route sitemaps to IndexNow (Bing, Yandex, Seznam, Naver...).
# Daily-pipeline stage 'index:routes'. Job sitemaps are NOT handled here (phase_f_priority_index_push.py +
# indexnow-submit-gone.mjs do that). Google's Indexing API only accepts JobPosting/livestream pages, so there is
# no Google leg for these; Google finds them through the sitemap index.
#
#   python scripts/push_route_sitemaps.py [--dry-run] [--max-urls 2000] [--only blog,tools]
#
# A sitemap that answers non-200 (e.g. the 503 the API-backed routes now return) is SKIPPED: nothing is
# submitted for it and its stored state is left alone, so the next run retries it. Exit code 2 if any enabled
# sitemap could not be read, so pipeline_runs shows the stage as failed even though the others were pushed.
import argparse, asyncio, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
import httpx
import os
from configs.config import settings
from services import route_sitemap_push as rsp

BASE_URL = os.environ.get('SITE_URL', 'https://intern-flow.in').rstrip('/')
INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'


def submit_indexnow(client: httpx.Client, urls):
    payload = {'host': settings.INDEXNOW_HOST, 'key': settings.INDEXNOW_KEY,
               'keyLocation': f'{BASE_URL}/{settings.INDEXNOW_KEY}.txt', 'urlList': urls}
    try:
        resp = client.post(INDEXNOW_ENDPOINT, json=payload, timeout=30)
        return resp.status_code in (200, 202), resp.status_code, resp.text[:200]
    except httpx.HTTPError as exc:
        return False, 0, str(exc)


async def main(dry_run: bool, max_urls: int, only: set) -> int:
    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=2)
    failed_sitemaps = 0
    submitted_total = 0
    try:
        rows = await pool.fetch("SELECT slug, path FROM sitemap_categories WHERE kind = 'route' AND enabled ORDER BY sort_order, slug")
        if not rows:
            print('push_route_sitemaps: sitemap_categories has no enabled route sitemaps', file=sys.stderr)
            return 2
        with httpx.Client(headers={'User-Agent': 'internflow-route-sitemap-push'}, follow_redirects=True) as client:
            for row in rows:
                slug, path = row['slug'], row['path']
                if only and slug not in only:
                    continue
                try:
                    resp = client.get(f'{BASE_URL}{path}', timeout=60)
                except httpx.HTTPError as exc:
                    print(f'push_route_sitemaps: {slug}: fetch failed ({exc}); skipped')
                    failed_sitemaps += 1
                    continue
                if resp.status_code != 200:
                    print(f'push_route_sitemaps: {slug}: HTTP {resp.status_code}; skipped (state untouched, retried next run)')
                    failed_sitemaps += 1
                    continue
                current = rsp.parse_sitemap(resp.text)
                known = {r['url']: (r['lastmod'] or '') for r in
                         await pool.fetch('SELECT url, lastmod FROM route_sitemap_urls WHERE sitemap_slug = $1', slug)}
                p = rsp.plan(known, current)
                todo = p['new'] + p['changed'] + p['removed']
                budget = max(0, max_urls - submitted_total)
                batch = todo[:budget]
                print(f"push_route_sitemaps: {slug}: {len(current)} urls | new={len(p['new'])} changed={len(p['changed'])} "
                      f"removed={len(p['removed'])} skipped_removals={len(p['skipped_removals'])} | submitting {len(batch)}"
                      f"{' (DRY RUN)' if dry_run else ''}")
                if not batch or dry_run:
                    continue
                sent = set()
                for chunk in rsp.chunks(batch):
                    ok, code, snippet = submit_indexnow(client, chunk)
                    print(f'push_route_sitemaps: {slug}: IndexNow HTTP {code} for {len(chunk)} urls {"" if ok else snippet}')
                    if ok:
                        sent.update(chunk)
                    else:
                        failed_sitemaps += 1
                submitted_total += len(sent)
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        for u in sent:
                            if u in current:
                                await conn.execute(
                                    '''INSERT INTO route_sitemap_urls (url, sitemap_slug, lastmod, last_submitted_at)
                                       VALUES ($1, $2, NULLIF($3, ''), now())
                                       ON CONFLICT (url) DO UPDATE SET lastmod = EXCLUDED.lastmod, last_submitted_at = now()''',
                                    u, slug, current[u])
                            else:                                  # removal notice sent -> forget the URL
                                await conn.execute('DELETE FROM route_sitemap_urls WHERE url = $1', u)
    finally:
        await pool.close()
    print(f'push_route_sitemaps: done, submitted={submitted_total}, sitemaps_with_problems={failed_sitemaps}')
    return 2 if failed_sitemaps else 0


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--max-urls', type=int, default=rsp.DEFAULT_MAX_URLS)
    p.add_argument('--only', default='', help='comma-separated sitemap_categories slugs')
    a = p.parse_args()
    sys.exit(asyncio.run(main(a.dry_run, a.max_urls, {s for s in a.only.split(',') if s})))
