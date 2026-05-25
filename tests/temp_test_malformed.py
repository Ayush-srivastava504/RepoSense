import sys, types, json, asyncio

# Mock neural_generator.llm to produce malformed JSON
neural_generator = types.ModuleType('neural_generator')
src = types.ModuleType('neural_generator.src')
app = types.ModuleType('neural_generator.src.app')

def mock_llm(prompt, max_tokens=1000, temperature=0.15, top_k=30, top_p=0.85, repeat_penalty=1.2, stop=None):
    # Intentionally malformed JSON: missing quotes on keys, missing commas
    malformed = """
    {
      summary: "AI Engineer",
      technical_skills: {
        languages: "Python"
        backend: "FastAPI"
      }
    }
    """
    return {"choices": [{"text": malformed}]}

app.llm = mock_llm
src.app = app
neural_generator.src = src
sys.modules['neural_generator'] = neural_generator
sys.modules['neural_generator.src'] = src
sys.modules['neural_generator.src.app'] = app

from services.api.src.services.resume_ai_service import ResumeAIService

async def run():
    service = ResumeAIService()
    result = await service.generate_resume_data('type','desc','skills','exp')
    print('Parsed:', json.dumps(result, indent=2))

asyncio.run(run())
