from ..configs.db import get_db_pool

class ResumeService:
    async def create_resume(self, user_id: str, title: str, content: dict):
        pool = await get_db_pool()
        row = await pool.fetchrow(
            "INSERT INTO resumes (user_id, title, content) VALUES ($1, $2, $3) RETURNING id",
            user_id, title, content
        )
        return {"id": row["id"], "title": title, "content": content}

    async def list_resumes(self, user_id: str):
        pool = await get_db_pool()
        rows = await pool.fetch("SELECT id, title, content, created_at FROM resumes WHERE user_id = $1", user_id)
        return [dict(r) for r in rows]