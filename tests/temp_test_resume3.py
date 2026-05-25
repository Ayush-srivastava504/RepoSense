import sys, types

# Create dummy neural_generator package hierarchy
neural_generator = types.ModuleType('neural_generator')
src = types.ModuleType('neural_generator.src')
app = types.ModuleType('neural_generator.src.app')

def mock_llm(prompt, max_tokens=1000, temperature=0.15, top_k=30, top_p=0.85, repeat_penalty=1.2, stop=None):
    # Return a simple JSON object as LLM output
    json_output = '''{
  "summary": "AI Engineer with 3 years experience",
  "technical_skills": {
    "languages": "Python, SQL",
    "backend": "FastAPI",
    "ai_ml": "LLM, Generative AI",
    "databases": "PostgreSQL",
    "tools": "Docker, Kubernetes"
  },
  "experience": [],
  "projects": []
}'''
    return {"choices": [{"text": json_output}]}

app.llm = mock_llm

# Register modules
src.app = app
neural_generator.src = src
sys.modules['neural_generator'] = neural_generator
sys.modules['neural_generator.src'] = src
sys.modules['neural_generator.src.app'] = app

# Now import the service
from services.api.src.services.resume_ai_service import ResumeAIService
import asyncio, json

async def main():
    service = ResumeAIService()
    result = await service.generate_resume_data(
        resume_type='AI Engineer',
        job_description='Develop AI models',
        skills='Python, SQL',
        experience='3 years'
    )
    print('Result:', json.dumps(result, indent=2))

asyncio.run(main())
