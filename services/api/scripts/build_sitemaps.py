# Rebuilds sitemap_cache from the jobs table. Run hourly (build-sitemaps.yml).
#   python scripts/build_sitemaps.py [--force]
import argparse, asyncio, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
from configs.config import settings
from services import sitemap_builder


async def main(force: bool) -> int:
    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=2)
    try:
        result = await sitemap_builder.rebuild(pool, force=force)
    except RuntimeError as e:
        print(f'build_sitemaps: FAILED - {e}', file=sys.stderr)
        return 2
    finally:
        await pool.close()
    print(f'build_sitemaps: {result}')
    return 0


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--force', action='store_true')
    sys.exit(asyncio.run(main(p.parse_args().force)))
