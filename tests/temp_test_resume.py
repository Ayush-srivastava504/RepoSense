import asyncio, json
from services.api.src.services.resume_ai_service import ResumeAIService

async def main():
    service = ResumeAIService()
    try:
        result = await service.generate_resume_data(
            resume_type="AI Engineer",
            job_description="Develop AI models",
            skills="Python, SQL",
            experience="3 years"
        )
        print('Result:', json.dumps(result, indent=2)[:500])
    except Exception as e:
        print('Error:', e)

asyncio.run(main())
