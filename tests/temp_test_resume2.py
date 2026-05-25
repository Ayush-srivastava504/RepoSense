import sys, types
# Mock fastapi module
fastapi = types.ModuleType('fastapi')
fastapi.FastAPI = object
fastapi.HTTPException = Exception
sys.modules['fastapi'] = fastapi

# Now import the service
from services.api.src.services.resume_ai_service import ResumeAIService
import asyncio, json

async def main():
    service = ResumeAIService()
    try:
        result = await service.generate_resume_data(
            resume_type='AI Engineer',
            job_description='Develop AI models',
            skills='Python, SQL',
            experience='3 years'
        )
        print('Result:', json.dumps(result, indent=2)[:500])
    except Exception as e:
        print('Error:', e)

asyncio.run(main())
