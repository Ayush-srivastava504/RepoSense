"""
Test configuration and fixtures.
"""
import sys
import os
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

# Mock external dependencies
@pytest.fixture(autouse=True)
def setup_mocks():
    """Setup all necessary mocks for tests."""
    import types
    
    # Mock neural_generator
    if 'neural_generator' not in sys.modules:
        neural_generator = types.ModuleType('neural_generator')
        src = types.ModuleType('neural_generator.src')
        app = types.ModuleType('neural_generator.src.app')
        
        def mock_llm(prompt, **kwargs):
            return {
                "choices": [{
                    "text": '{"summary": "Mock response", "technical_skills": {"languages": "Python"}}'
                }]
            }
        
        app.llm = mock_llm
        src.app = app
        neural_generator.src = src
        sys.modules['neural_generator'] = neural_generator
        sys.modules['neural_generator.src'] = src
        sys.modules['neural_generator.src.app'] = app
    
    # Mock fastapi
    if 'fastapi' not in sys.modules:
        fastapi = types.ModuleType('fastapi')
        fastapi.FastAPI = object
        fastapi.HTTPException = Exception
        fastapi.Request = object
        fastapi.Response = object
        fastapi.APIRouter = object
        sys.modules['fastapi'] = fastapi
        
        # Mock fastapi submodules
        for submodule in ['depends', 'security', 'responses', 'status', 'routing']:
            if f'fastapi.{submodule}' not in sys.modules:
                sub = types.ModuleType(f'fastapi.{submodule}')
                sys.modules[f'fastapi.{submodule}'] = sub
    
    # Mock pydantic
    if 'pydantic' not in sys.modules:
        pydantic = types.ModuleType('pydantic')
        pydantic.BaseModel = object
        pydantic.Field = lambda *args, **kwargs: None
        pydantic.HttpUrl = str
        sys.modules['pydantic'] = pydantic
        sys.modules['pydantic_settings'] = types.ModuleType('pydantic_settings')
    
    # Mock httpx
    if 'httpx' not in sys.modules:
        httpx = types.ModuleType('httpx')
        httpx.AsyncClient = object
        httpx.Client = object
        httpx.HTTPError = Exception
        sys.modules['httpx'] = httpx
    
    # Mock sqlalchemy
    if 'sqlalchemy' not in sys.modules:
        sqlalchemy = types.ModuleType('sqlalchemy')
        sqlalchemy.create_engine = lambda *args, **kwargs: object()
        sqlalchemy.orm = types.ModuleType('sqlalchemy.orm')
        sqlalchemy.orm.sessionmaker = lambda *args, **kwargs: object()
        sys.modules['sqlalchemy'] = sqlalchemy
        
    # Mock redis
    if 'redis' not in sys.modules:
        redis = types.ModuleType('redis')
        redis.Redis = object
        redis.ConnectionPool = object
        sys.modules['redis'] = redis
        sys.modules['redis.asyncio'] = types.ModuleType('redis.asyncio')
    
    yield

@pytest.fixture
def mock_db_pool():
    """Mock database connection pool."""
    pool = AsyncMock()
    pool.fetchrow = AsyncMock()
    pool.fetchval = AsyncMock()
    pool.fetch = AsyncMock()
    pool.execute = AsyncMock()
    return pool

@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    return redis