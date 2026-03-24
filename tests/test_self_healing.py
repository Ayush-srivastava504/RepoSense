import pytest
from fastapi.testclient import TestClient
from app.core.app import app
import json

client = TestClient(app)

class TestSelfHealingEndpoints:
    def test_auto_fix_endpoint(self):
        code = "x = None\nprint(x.value)"
        
        response = client.post(
            "/api/v1/self-healing/fix",
            json={
                "code": code,
                "language": "python",
                "auto_validate": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "applied_fixes" in data
        assert data["iterations"] > 0
    
    def test_validate_endpoint_valid(self):
        code = "def test():\n    return True"
        
        response = client.post(
            "/api/v1/self-healing/validate",
            json={
                "code": code,
                "language": "python"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["passed"] == True
        assert len(data["errors"]) == 0
    
    def test_validate_endpoint_invalid(self):
        code = "def test()\n    return"
        
        response = client.post(
            "/api/v1/self-healing/validate",
            json={
                "code": code,
                "language": "python"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["passed"] == False
        assert len(data["errors"]) > 0
    
    def test_fix_and_validate_endpoint(self):
        code = """
api_key = 'hardcoded123'
result = None
print(result.value)
        """
        
        response = client.post(
            "/api/v1/self-healing/fix-and-validate",
            json={
                "code": code,
                "language": "python",
                "max_fix_iterations": 3
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["success", "failed"]
    
    def test_multiple_iterations(self):
        code = """
def long_function_with_many_parameters(param1, param2, param3, param4, param5, param6, param7, param8):
    x = None
    return x.value
        """
        
        response = client.post(
            "/api/v1/self-healing/fix",
            json={
                "code": code,
                "language": "python",
                "max_fix_iterations": 5,
                "auto_validate": True
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["iterations"] <= 5
        
        if data["success"]:
            assert "if x is not None" in data["fixed_code"] or "with" in data["fixed_code"]

class TestSelfHealingIntegration:
    def test_concurrent_fixes(self):
        codes = [
            "x = None\nprint(x)",
            "password = 'secret'",
            "def long():" + "a" * 200
        ]
        
        for code in codes:
            response = client.post(
                "/api/v1/self-healing/fix",
                json={
                    "code": code,
                    "language": "python",
                    "auto_validate": True
                }
            )
            assert response.status_code == 200
            data = response.json()
            
            if data["success"]:
                validate_response = client.post(
                    "/api/v1/self-healing/validate",
                    json={
                        "code": data["fixed_code"],
                        "language": "python"
                    }
                )
                assert validate_response.json()["passed"] == True
    
    def test_fix_quality_tracking(self):
        test_cases = [
            ("null_reference", "x = None\nprint(x)"),
            ("hardcoded_secret", "api_key = '123'"),
            ("long_line", "x" * 200),
            ("complex_expression", "if x and y and z and w and v:"),
        ]
        
        results = []
        for case_name, code in test_cases:
            response = client.post(
                "/api/v1/self-healing/fix",
                json={
                    "code": code,
                    "language": "python",
                    "auto_validate": True
                }
            )
            results.append({
                "case": case_name,
                "success": response.json()["success"],
                "fixes": len(response.json()["applied_fixes"])
            })
        
        assert any(r["success"] for r in results)
        assert all(r["fixes"] >= 0 for r in results)