# test_performance.py
import time
import asyncio
import httpx
import statistics

async def benchmark_review():
    base_url = "http://localhost:8000/api/v1"
    code = """
def complex_function(x, y, z):
    if x > 0:
        for i in range(100):
            if i % 2 == 0:
                result = x * y / z
                if result > 10:
                    return result
    return None
    """ * 10
    
    latencies = []
    iterations = 20
    
    async with httpx.AsyncClient() as client:
        for i in range(iterations):
            start = time.time()
            response = await client.post(
                f"{base_url}/review",
                json={
                    "code": code,
                    "language": "python",
                    "include_metrics": True
                }
            )
            latency = (time.time() - start) * 1000
            latencies.append(latency)
            
            if (i + 1) % 5 == 0:
                print(f"Completed {i + 1}/{iterations} requests")
    
    print(f"\nPerformance Results:")
    print(f"Average latency: {statistics.mean(latencies):.2f}ms")
    print(f"Median latency: {statistics.median(latencies):.2f}ms")
    print(f"P95 latency: {statistics.quantiles(latencies, n=100)[94]:.2f}ms")
    print(f"Throughput: {iterations / (sum(latencies) / 1000):.2f} req/sec")

if __name__ == "__main__":
    asyncio.run(benchmark_review())