# validate_system.py
import sys
import asyncio
import httpx
from typing import Dict, Any

class SystemValidator:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
    
    async def run_all_tests(self) -> Dict[str, Any]:
        results = {
            "total": 0,
            "passed": 0,
            "failed": 0,
            "tests": []
        }
        
        # Test 1: Health Check
        results["tests"].append(await self.test_health())
        
        # Test 2: Model Loading
        results["tests"].append(await self.test_model_loading())
        
        # Test 3: Code Review
        results["tests"].append(await self.test_code_review())
        
        # Test 4: Auto-Fix
        results["tests"].append(await self.test_auto_fix())
        
        # Test 5: Validation
        results["tests"].append(await self.test_validation())
        
        # Test 6: Batch Processing
        results["tests"].append(await self.test_batch_processing())
        
        # Calculate totals
        for test in results["tests"]:
            results["total"] += 1
            if test["passed"]:
                results["passed"] += 1
            else:
                results["failed"] += 1
        
        return results
    
    async def test_health(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/api/v1/health")
            data = response.json()
            
            passed = response.status_code == 200 and data.get("status") == "healthy"
            return {
                "name": "Health Check",
                "passed": passed,
                "details": data
            }
    
    async def test_model_loading(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.base_url}/api/v1/health")
            data = response.json()
            
            passed = data.get("model_loaded", False)
            return {
                "name": "Model Loading",
                "passed": passed,
                "details": {"model_loaded": passed, "gpu": data.get("gpu_available")}
            }
    
    async def test_code_review(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/review",
                json={
                    "code": "def test():\n    x = None\n    return x.value",
                    "language": "python",
                    "include_metrics": True
                }
            )
            
            data = response.json()
            passed = response.status_code == 200 and data.get("issues_found", 0) > 0
            
            return {
                "name": "Code Review",
                "passed": passed,
                "details": {
                    "issues_found": data.get("issues_found", 0),
                    "processing_time": data.get("processing_time_ms", 0)
                }
            }
    
    async def test_auto_fix(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/self-healing/fix",
                json={
                    "code": "x = None\nprint(x.value)",
                    "language": "python",
                    "auto_validate": True
                }
            )
            
            data = response.json()
            passed = response.status_code == 200 and data.get("success", False)
            
            return {
                "name": "Auto-Fix",
                "passed": passed,
                "details": {
                    "fixes_applied": len(data.get("applied_fixes", [])),
                    "iterations": data.get("iterations", 0)
                }
            }
    
    async def test_validation(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/self-healing/validate",
                json={
                    "code": "def valid(): return True",
                    "language": "python"
                }
            )
            
            data = response.json()
            passed = response.status_code == 200 and data.get("passed", False)
            
            return {
                "name": "Validation",
                "passed": passed,
                "details": {"valid": passed}
            }
    
    async def test_batch_processing(self) -> Dict[str, Any]:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/batch-review",
                json={
                    "requests": [
                        {"code": "def test1(): pass", "language": "python"},
                        {"code": "def test2(): pass", "language": "python"}
                    ]
                }
            )
            
            data = response.json()
            passed = response.status_code == 200 and data.get("successful", 0) == 2
            
            return {
                "name": "Batch Processing",
                "passed": passed,
                "details": {
                    "total": data.get("total_items", 0),
                    "successful": data.get("successful", 0)
                }
            }

async def main():
    validator = SystemValidator()
    results = await validator.run_all_tests()
    
    print("\n" + "="*60)
    print("SYSTEM VALIDATION RESULTS")
    print("="*60)
    
    for test in results["tests"]:
        status = "✓ PASSED" if test["passed"] else "✗ FAILED"
        print(f"\n{status}: {test['name']}")
        if test.get("details"):
            for key, value in test["details"].items():
                print(f"  - {key}: {value}")
    
    print("\n" + "="*60)
    print(f"SUMMARY: {results['passed']}/{results['total']} tests passed")
    print("="*60)
    
    if results["failed"] > 0:
        sys.exit(1)
    else:
        print("\n✓ All tests passed! System is ready for production.")

if __name__ == "__main__":
    asyncio.run(main())