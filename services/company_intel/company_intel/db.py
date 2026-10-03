"""All SQL for company_intel. asyncpg; jsonb passed as JSON text."""
import json
import re
from typing import Optional


def name_key(name: str) -> str:
    return re.sub(r'[^a-z0-9]+', '', name.lower())


def company_slug(name: str) -> str:
    """Identical to companySlug() in apps/web/lib/companies.ts."""
    return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', name.lower()))


SEED_ROWS_SQL = """
SELECT company, apply_domain, bool_or(is_official_domain) AS official, count(*) AS n
FROM jobs
WHERE company IS NOT NULL AND company <> '' AND apply_domain IS NOT NULL
GROUP BY company, apply_domain
"""

UPSERT_ENTITY_SQL = """
INSERT INTO company_entities (slug, name, name_key, official_domain, domain_source, logo_domain, status, status_reason)
VALUES ($1, $2, $3, $4, 'jobs', $4, $5, $6)
ON CONFLICT (name_key) DO UPDATE SET
    official_domain = CASE WHEN company_entities.domain_source = 'manual' THEN company_entities.official_domain
                           ELSE EXCLUDED.official_domain END,
    logo_domain     = CASE WHEN company_entities.domain_source = 'manual' THEN company_entities.logo_domain
                           ELSE EXCLUDED.logo_domain END,
    status          = CASE WHEN company_entities.status = 'blocked' THEN 'blocked'
                           WHEN EXCLUDED.official_domain IS NULL THEN 'skipped'
                           WHEN company_entities.status = 'skipped' THEN 'pending'
                           ELSE company_entities.status END,
    status_reason   = EXCLUDED.status_reason,
    updated_at      = now()
RETURNING id
"""

UPSERT_MANUAL_ENTITY_SQL = """
INSERT INTO company_entities (slug, name, name_key, official_domain, domain_source, logo_domain, status, status_reason)
VALUES ($1, $2, $3, $4, 'manual', $4, 'pending', NULL)
ON CONFLICT (name_key) DO UPDATE SET
    official_domain = EXCLUDED.official_domain, logo_domain = EXCLUDED.logo_domain, domain_source = 'manual',
    status = CASE WHEN company_entities.status IN ('blocked', 'active') THEN company_entities.status ELSE 'pending' END,
    status_reason = NULL, updated_at = now()
RETURNING id
"""

NEXT_TO_CRAWL_SQL = """
SELECT id, slug, name, official_domain FROM company_entities
WHERE status IN ('pending', 'active') AND official_domain IS NOT NULL
  AND ($2::text IS NULL OR slug = $2)
  AND (last_crawled_at IS NULL OR last_crawled_at < now() - make_interval(days => $3))
ORDER BY last_crawled_at NULLS FIRST, id
LIMIT $1
"""

UPSERT_SOURCE_SQL = """
INSERT INTO company_sources (entity_id, url, topic_hint, title, text, content_hash)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (entity_id, url) DO UPDATE SET topic_hint = EXCLUDED.topic_hint, title = EXCLUDED.title,
    text = EXCLUDED.text, content_hash = EXCLUDED.content_hash, fetched_at = now()
"""

MARK_CRAWLED_SQL = "UPDATE company_entities SET last_crawled_at = now(), status = $2, status_reason = $3, updated_at = now() WHERE id = $1"

NEXT_TO_ENRICH_SQL = """
SELECT e.id, e.slug, e.name FROM company_entities e
WHERE e.status = 'active' AND ($2::text IS NULL OR e.slug = $2)
  AND EXISTS (SELECT 1 FROM company_sources s WHERE s.entity_id = e.id)
ORDER BY (SELECT max(enriched_at) FROM company_topics t WHERE t.entity_id = e.id) NULLS FIRST, e.id
LIMIT $1
"""

SOURCES_SQL = "SELECT url, topic_hint, title, text, content_hash FROM company_sources WHERE entity_id = $1 ORDER BY length(text) DESC"
TOPIC_HASHES_SQL = "SELECT topic_key, source_hash, status FROM company_topics WHERE entity_id = $1"

UPSERT_TOPIC_SQL = """
INSERT INTO company_topics (entity_id, topic_key, title, body, bullets, source_urls, source_hash, model, status, reject_reason, enriched_at)
VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, now())
ON CONFLICT (entity_id, topic_key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, bullets = EXCLUDED.bullets,
    source_urls = EXCLUDED.source_urls, source_hash = EXCLUDED.source_hash, model = EXCLUDED.model,
    status = EXCLUDED.status, reject_reason = EXCLUDED.reject_reason, enriched_at = now()
"""


def bullets_json(bullets: Optional[list]) -> str:
    return json.dumps(bullets or [])

