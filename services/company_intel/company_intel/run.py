"""CLI:  python -m company_intel.run {seed|crawl|enrich|all} [--limit N] [--only SLUG] [--dry-run]
Needs DATABASE_URL (+ GROQ_API_KEY / GEMINI_API_KEY / NVIDIA_API_KEY for enrich)."""
import argparse
import asyncio
import os
import sys

import asyncpg

from . import db, pipeline
import httpx

from .fetcher import PoliteFetcher, USER_AGENT
from .wikidata import WikidataSource
from .llm import Writer, providers_from_env


async def main(argv: list) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('stage', choices=['seed', 'crawl', 'enrich', 'all'])
    ap.add_argument('--limit', type=int, default=50)
    ap.add_argument('--only', default=None, help='single company slug')
    ap.add_argument('--no-wikidata', action='store_true', help='crawl: skip the Wikidata source')
    ap.add_argument('--render', action='store_true', help='crawl: headless-browser fallback for JS-only pages (needs playwright)')
    ap.add_argument('--dry-run', action='store_true', help='enrich: call the model but write nothing')
    args = ap.parse_args(argv)
    if not os.environ.get('DATABASE_URL'):
        print('company_intel: DATABASE_URL is not set', file=sys.stderr)
        return 2
    pool = await asyncpg.create_pool(os.environ['DATABASE_URL'], min_size=1, max_size=3)
    try:
        if args.stage in ('seed', 'all'):
            print('seed:', await pipeline.seed(pool))
        if args.stage in ('crawl', 'all'):
            renderer = None
            if args.render:
                from .render import PlaywrightRenderer
                renderer = PlaywrightRenderer()
            fetcher = PoliteFetcher(renderer=renderer)
            wd_client = httpx.AsyncClient(headers={'User-Agent': USER_AGENT}, timeout=15)
            wikidata = None if args.no_wikidata else WikidataSource(wd_client)
            try:
                for e in await pool.fetch(db.NEXT_TO_CRAWL_SQL, args.limit, args.only, pipeline.RECRAWL_AFTER_DAYS):
                    print('crawl', e['slug'], await pipeline.crawl_entity(pool, fetcher, e, wikidata=wikidata))
            finally:
                await fetcher.close()
                await wd_client.aclose()
                if renderer:
                    await renderer.close()
        if args.stage in ('enrich', 'all'):
            providers = providers_from_env()
            if not providers:
                print('company_intel: no LLM provider key configured', file=sys.stderr)
                return 2
            writer = Writer(providers)
            for e in await pool.fetch(db.NEXT_TO_ENRICH_SQL, args.limit, args.only):
                print('enrich', e['slug'], await pipeline.enrich_entity(pool, writer, e, dry_run=args.dry_run))
    finally:
        await pool.close()
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main(sys.argv[1:])))
