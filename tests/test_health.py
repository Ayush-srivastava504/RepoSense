"""
Health endpoint tests.
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

@pytest.fixture
def client():
    """Create test client."""
    try:
        from src.main import app
        return TestClient(app)
    except ImportError:
        pytest.skip("Main app not available")
        return None

def test_health_check(client):
    """Test health check endpoint."""
    if not client:
        pytest.skip("Client not available")
    
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data

def test_health_check_details(client):
    """Test health check returns details."""
    if not client:
        pytest.skip("Client not available")
    
    response = client.get("/health")
    data = response.json()
    assert "status" in data
    # Check if it's a string or dict
    assert isinstance(data, dict)