# Module: src/routes/sitemap.py
# Serves prebuilt job sitemap files from sitemap_cache (see services/sitemap_builder.py).
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from configs.db import get_db_pool

router = APIRouter(prefix='/api/sitemap', tags=['sitemap'])
_NAME = re.compile(r'^[a-z][a-z-]{0,40}-[1-9]\d{0,3}\.xml$')  # category set lives in sitemap_categories; a missing file 404s below


@router.get('/files')
async def list_files():
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    rows = await pool.fetch('SELECT file_name, category, page, url_count, built_at FROM sitemap_cache ORDER BY category, page')
    if not rows:
        raise HTTPException(503, 'Sitemap cache not built yet')
    return {'files': [dict(r) for r in rows]}


@router.get('/files/{file_name}')
async def get_file(file_name: str):
    if not _NAME.match(file_name):
        raise HTTPException(404, 'Not found')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow('SELECT xml FROM sitemap_cache WHERE file_name = $1', file_name)
    if row is None:
        raise HTTPException(404, 'Not found')
    return Response(content=row['xml'], media_type='application/xml')


@router.get('/categories')
async def list_categories():
    """Enabled sitemap_categories rows (migration 030). The web sitemap index is built from
    this so adding/disabling a sitemap is a data change, not a deploy."""
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    rows = await pool.fetch(
        'SELECT slug, kind, path, sort_order FROM sitemap_categories WHERE enabled ORDER BY sort_order, slug')
    if not rows:
        raise HTTPException(503, 'Sitemap registry empty')
    return {'categories': [dict(r) for r in rows]}
