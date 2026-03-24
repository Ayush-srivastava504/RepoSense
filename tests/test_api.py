import pytest
from fastapi.testclient import TestClient
from app.core.app import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data

def test_review_endpoint():
    response = client.post(
        "/api/v1/review",
        json={
            "code": "def test(): pass",
            "language": "python",
            "include_metrics": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "request_id" in data
    assert "issues" in data

def test_validate_code():
    response = client.post(
        "/api/v1/validate-code",
        json={
            "code": "print('hello')",
            "language": "python"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] == True
    assert data["lines"] == 1