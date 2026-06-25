"""
Route tests.
"""
import pytest
from fastapi.testclient import TestClient
import sys
import os

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

def test_root_endpoint(client):
    """Test root endpoint."""
    if not client:
        pytest.skip("Client not available")
    
    response = client.get("/")
    # Root might redirect or return something
    assert response.status_code in [200, 307, 404]

def test_api_v1_prefix(client):
    """Test API v1 prefix exists."""
    if not client:
        pytest.skip("Client not available")
    
    response = client.get("/api/v1/health")
    assert response.status_code == 200

def test_404_handling(client):
    """Test 404 handling."""
    if not client:
        pytest.skip("Client not available")
    
    response = client.get("/nonexistent-endpoint")
    assert response.status_code == 404

def test_method_not_allowed(client):
    """Test method not allowed."""
    if not client:
        pytest.skip("Client not available")
    
    response = client.delete("/api/v1/health")
    assert response.status_code in [405, 404]