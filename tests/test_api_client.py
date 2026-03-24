import httpx
import asyncio

async def test_api():
    base_url = "http://localhost:8000/api/v1"
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{base_url}/health")
        print("Health STATUS:", resp.status_code)
        print("Health RAW:", resp.text)
        
        review_data = {
            "code": """
def buggy():
    x = None
    return x.value
            """,
            "language": "python",
            "include_metrics": True
        }
        
        resp = await client.post(f"{base_url}/review", json=review_data)
        print("\nReview STATUS:", resp.status_code)
        print("Review RAW:", resp.text)
        
        if resp.status_code == 200:
            result = resp.json()
            print(f"\nReview found {result.get('issues_found', 0)} issues")
        
        fix_data = {
            "code": review_data["code"],
            "language": "python",
            "auto_validate": True,
            "max_fix_iterations": 3
        }
        
        resp = await client.post(f"{base_url}/self-healing/fix", json=fix_data)
        print("\nFix STATUS:", resp.status_code)
        print("Fix RAW:", resp.text)
        
        if resp.status_code == 200:
            fix_result = resp.json()
            print(f"\nAuto-fix applied {len(fix_result.get('applied_fixes', []))} fixes")
            if fix_result.get("success"):
                print("Fixed code generated successfully")

if __name__ == "__main__":
    asyncio.run(test_api())