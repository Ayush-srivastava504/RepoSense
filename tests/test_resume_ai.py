import asyncio, json, sys
sys.path.append(r'E:\Repo_Sense\services\api')
from src.services.resume_ai_service import ResumeAIService

async def main():
    service = ResumeAIService()
    data = await service.generate_resume_data(
        resume_type='AI Engineer',
        job_description='Develop AI models',
        skills='Python, SQL, Docker',
        experience='3 years at XYZ'
    )
    print('Parsed JSON:', json.dumps(data, indent=2))

asyncio.run(main())
