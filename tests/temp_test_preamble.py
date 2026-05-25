import sys, types, json, asyncio

# Mock neural_generator.llm to produce output with preamble text and extra after JSON
neural_generator = types.ModuleType('neural_generator')
src = types.ModuleType('neural_generator.src')
app = types.ModuleType('neural_generator.src.app')

def mock_llm(prompt, **kwargs):
    output = """Here is the resume JSON you requested:\n\n{\n  \"summary\": \"AI Engineer\",\n  \"technical_skills\": {\n    \"languages\": \"Python\",\n    \"backend\": \"FastAPI\"\n  }\n}\nThank you!\n"""
    return {"choices": [{"text": output}]}

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
