# Recomputes chart_stats from the jobs table. Runs nightly as the 'charts' stage of daily-pipeline.yml.
#   python scripts/build_chart_stats.py
import asyncio, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
from configs.config import settings
from services import chart_aggregator


async def main() -> int:
    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=2)
    try:
        result = await chart_aggregator.rebuild(pool)
    except RuntimeError as e:
        print(f'build_chart_stats: FAILED - {e}', file=sys.stderr)
        return 2
    finally:
        await pool.close()
    print(f'build_chart_stats: {result}')
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
