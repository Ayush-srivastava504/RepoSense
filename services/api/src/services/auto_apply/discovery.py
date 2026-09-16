import asyncio
import logging
import urllib.parse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from configs.db import get_db_pool

logger = logging.getLogger(__name__)

class DiscoveredJob(BaseModel):
    id: str
    title: str
    company: str
    location: str = ""
    is_remote: bool = False
    apply_url: str
    ats_type: str = "generic" # greenhouse, lever, ashby, workable, bamboohr, generic
    required_skills: List[str] = Field(default_factory=list)
    description: str = ""
    source: str = "database"
    posted_at: Optional[str] = ""

class JobDiscoveryEngine:
    """Layer 2: Job Discovery Engine."""

    def detect_ats_type(self, apply_url: str) -> str:
        """Classify ATS provider from apply URL domain."""
        url_lower = apply_url.lower()
        if "greenhouse.io" in url_lower or "boards.greenhouse.io" in url_lower:
            return "greenhouse"
        elif "lever.co" in url_lower or "jobs.lever.co" in url_lower:
            return "lever"
        elif "ashbyhq.com" in url_lower or "jobs.ashbyhq.com" in url_lower:
            return "ashby"
        elif "workable.com" in url_lower:
            return "workable"
        elif "bamboohr.com" in url_lower:
            return "bamboohr"
        return "generic"

    async def fetch_database_jobs(
        self,
        limit: int = 50,
        is_remote: Optional[bool] = None,
        search_query: Optional[str] = None
    ) -> List[DiscoveredJob]:
        """Fetch active job postings directly from RepoSense DB pool."""
        try:
            pool = await asyncio.wait_for(get_db_pool(), timeout=2.0)
        except Exception as e:
            logger.warning(f"DB pool connection unavailable: {e}")
            pool = None

        if not pool:
            logger.warning("DB pool unavailable. Returning empty discovery list.")
            return []

        query = """
            SELECT id, title, company, location, is_remote, url, apply_domain,
                   required_skills, description, source, posted_at
            FROM jobs
            WHERE (deadline IS NULL OR deadline > now())
        """
        params = []
        param_idx = 1

        if is_remote is not None:
            query += f" AND is_remote = ${param_idx}"
            params.append(is_remote)
            param_idx += 1

        if search_query:
            query += f" AND (lower(title) LIKE ${param_idx} OR lower(description) LIKE ${param_idx})"
            params.append(f"%{search_query.lower()}%")
            param_idx += 1

        query += f" ORDER BY posted_at DESC NULLS LAST LIMIT ${param_idx}"
        params.append(limit)

        try:
            records = await pool.fetch(query, *params)
            jobs = []
            for r in records:
                apply_url = r['url'] or f"https://{r['apply_domain']}" if r['apply_domain'] else ""
                skills = r['required_skills'] or []
                if isinstance(skills, str):
                    skills = [s.strip() for s in skills.split(',') if s.strip()]

                jobs.append(DiscoveredJob(
                    id=str(r['id']),
                    title=r['title'] or "Software Engineer",
                    company=r['company'] or "Company",
                    location=r['location'] or "",
                    is_remote=bool(r['is_remote']),
                    apply_url=apply_url,
                    ats_type=self.detect_ats_type(apply_url),
                    required_skills=skills,
                    description=r['description'] or "",
                    source=r['source'] or "database",
                    posted_at=str(r['posted_at']) if r['posted_at'] else ""
                ))
            return jobs
        except Exception as e:
            logger.error(f"Error fetching jobs from database: {e}")
            return []

    async def fetch_greenhouse_api(self, board_token: str) -> List[DiscoveredJob]:
        """Programmatically fetch jobs from Greenhouse API endpoint."""
        import httpx
        url = f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true"
        jobs = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get('jobs', []):
                        jobs.append(DiscoveredJob(
                            id=str(item.get('id')),
                            title=item.get('title', ''),
                            company=board_token.capitalize(),
                            location=item.get('location', {}).get('name', ''),
                            apply_url=item.get('absolute_url', ''),
                            ats_type="greenhouse",
                            description=item.get('content', ''),
                            source="greenhouse_api"
                        ))
        except Exception as e:
            logger.error(f"Failed Greenhouse API discovery for {board_token}: {e}")
        return jobs

    async def fetch_lever_api(self, company_name: str) -> List[DiscoveredJob]:
        """Programmatically fetch jobs from Lever API endpoint."""
        import httpx
        url = f"https://api.lever.co/v0/postings/{company_name}"
        jobs = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data:
                        jobs.append(DiscoveredJob(
                            id=str(item.get('id')),
                            title=item.get('text', ''),
                            company=company_name.capitalize(),
                            location=item.get('categories', {}).get('location', ''),
                            is_remote="remote" in item.get('categories', {}).get('location', '').lower(),
                            apply_url=item.get('applyUrl', item.get('hostedUrl', '')),
                            ats_type="lever",
                            description=item.get('descriptionPlain', ''),
                            source="lever_api"
                        ))
        except Exception as e:
            logger.error(f"Failed Lever API discovery for {company_name}: {e}")
        return jobs
