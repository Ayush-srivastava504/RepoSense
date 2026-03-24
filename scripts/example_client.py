import httpx
import asyncio

async def main():
    base_url = "http://localhost:8000/api/v1"
    
    code = """
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total += num
    return total / len(numbers)

result = calculate_average([1, 2, 3, 4, 5])
print(result)
    """
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/review",
            json={
                "code": code,
                "language": "python",
                "include_metrics": True
            }
        )
        
        print("Review Results:")
        print(response.json())

if __name__ == "__main__":
    asyncio.run(main())