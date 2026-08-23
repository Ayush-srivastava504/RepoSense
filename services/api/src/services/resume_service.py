# Module: src/services/resume_service.py
# Defines class(es): ResumeService
#
#

from configs.db import get_db_pool

class ResumeService:

    async def create_resume(self, user_id: str, title: str, content: str):
        pool = await get_db_pool()
        row = await pool.fetchrow('\n            INSERT INTO resumes\n            (\n                user_id,\n                title,\n                content\n            )\n            VALUES ($1, $2, $3)\n            RETURNING id\n            ', user_id, title, content)
        return {'id': row['id'], 'title': title, 'content': content}

    async def list_resumes(self, user_id: str):
        pool = await get_db_pool()
        rows = await pool.fetch('\n            SELECT\n                id,\n                title,\n                content,\n                created_at\n            FROM resumes\n            WHERE user_id = $1\n            ORDER BY created_at DESC\n            ', user_id)
        return [dict(r) for r in rows]
