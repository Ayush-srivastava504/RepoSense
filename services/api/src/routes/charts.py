# Module: src/routes/charts.py
# Serves the nightly aggregates in chart_stats (see services/chart_aggregator.py).
import re
from fastapi import APIRouter, HTTPException, Response
from configs.db import get_db_pool

router = APIRouter(prefix='/api/charts', tags=['charts'])
_KEY = re.compile(r'^(segment|topic):[\w .:\-+/&]{1,160}$')


@router.get('/{chart_key:path}')
async def get_chart(chart_key: str, response: Response):
    """chart_key examples: topic:machine-learning-engineer, segment:full-time:software:remote.
    404 means 'not enough listings to chart honestly' -- callers should render no chart."""
    if not _KEY.match(chart_key):
        raise HTTPException(404, 'Not found')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow('SELECT chart_key, kind, sample_size, stats, computed_at FROM chart_stats WHERE chart_key = $1', chart_key)
    if row is None:
        raise HTTPException(404, 'Not found')
    response.headers['Cache-Control'] = 'public, max-age=3600'
    stats = row['stats']
    if isinstance(stats, str):
        import json
        stats = json.loads(stats)
    return {'chart_key': row['chart_key'], 'kind': row['kind'], 'sample_size': row['sample_size'],
            'computed_at': row['computed_at'].isoformat(), 'stats': stats}
