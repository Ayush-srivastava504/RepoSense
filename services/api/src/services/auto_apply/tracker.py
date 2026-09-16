import asyncio
import logging
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from configs.db import get_db_pool

logger = logging.getLogger(__name__)

class ApplicationRecord(BaseModel):
    id: Optional[str] = None
    user_id: str = "default_user"
    job_id: str
    company: str
    title: str
    status: str  # QUEUED, APPLYING, APPLIED, DRY_RUN_SUCCESS, FAILED, INTERVIEWING
    applied_at: str = ""
    resume_version: str = "default_v1"
    logs: Optional[str] = ""
    screenshot_path: Optional[str] = None

class ApplicationTrackerEngine:
    """Layer 5: Application Tracking & Logging Engine."""

    async def ensure_table_exists(self):
        """Ensure job_applications tracking table exists in PostgreSQL database."""
        try:
            pool = await asyncio.wait_for(get_db_pool(), timeout=2.0)
        except Exception as e:
            logger.warning(f"DB pool connection unavailable for tracker: {e}")
            return
        if not pool:
            return

        query = """
        CREATE TABLE IF NOT EXISTS job_applications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL DEFAULT 'default_user',
            job_id VARCHAR(255) NOT NULL,
            company VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'APPLIED',
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            resume_version VARCHAR(100) DEFAULT 'v1',
            logs TEXT,
            screenshot_path VARCHAR(500),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_job_apps_user_job ON job_applications(user_id, job_id);
        CREATE INDEX IF NOT EXISTS idx_job_apps_company ON job_applications(company);
        """
        try:
            await pool.execute(query)
        except Exception as e:
            logger.warning(f"Note on job_applications table creation: {e}")

    async def is_already_applied(self, user_id: str, job_id: str, company: str) -> bool:
        """Check if candidate already applied to this job or company within 60 days."""
        await self.ensure_table_exists()
        try:
            pool = await get_db_pool()
        except Exception:
            pool = None

        if not pool:
            return False

        query = """
            SELECT COUNT(*) FROM job_applications
            WHERE user_id = $1
              AND (job_id = $2 OR lower(company) = lower($3))
              AND status IN ('APPLIED', 'DRY_RUN_SUCCESS', 'INTERVIEWING')
              AND applied_at > now() - interval '60 days'
        """
        try:
            count = await pool.fetchval(query, user_id, job_id, company)
            return count > 0
        except Exception as e:
            logger.error(f"Failed application deduplication check: {e}")
            return False

    async def log_application(self, record: ApplicationRecord) -> str:
        """Log or update an application submission record in PostgreSQL."""
        await self.ensure_table_exists()
        try:
            pool = await get_db_pool()
        except Exception:
            pool = None

        applied_timestamp = record.applied_at or datetime.utcnow().isoformat()

        if not pool:
            logger.info(f"[DB-Bypass Log] Application logged: {record.company} - {record.title} [{record.status}]")
            return "simulated_id"

        query = """
            INSERT INTO job_applications (user_id, job_id, company, title, status, applied_at, resume_version, logs, screenshot_path)
            VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
            RETURNING id::text
        """
        try:
            app_id = await pool.fetchval(
                query,
                record.user_id,
                record.job_id,
                record.company,
                record.title,
                record.status,
                record.resume_version,
                record.logs,
                record.screenshot_path
            )
            logger.info(f"Logged application ID {app_id} for {record.company} [{record.status}]")
            return app_id
        except Exception as e:
            logger.error(f"Failed to log application record: {e}")
            return "error_id"

    async def get_application_history(self, user_id: str = "default_user", limit: int = 50) -> List[ApplicationRecord]:
        """Fetch candidate application submission history."""
        await self.ensure_table_exists()
        try:
            pool = await get_db_pool()
        except Exception:
            pool = None

        if not pool:
            return []

        query = """
            SELECT id::text, user_id, job_id, company, title, status, applied_at::text, resume_version, logs, screenshot_path
            FROM job_applications
            WHERE user_id = $1
            ORDER BY applied_at DESC
            LIMIT $2
        """
        try:
            records = await pool.fetch(query, user_id, limit)
            return [
                ApplicationRecord(
                    id=r['id'],
                    user_id=r['user_id'],
                    job_id=r['job_id'],
                    company=r['company'],
                    title=r['title'],
                    status=r['status'],
                    applied_at=r['applied_at'],
                    resume_version=r['resume_version'],
                    logs=r['logs'],
                    screenshot_path=r['screenshot_path']
                )
                for r in records
            ]
        except Exception as e:
            logger.error(f"Failed to query application history: {e}")
            return []
