import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import httpx
from app.main import app


async def run_health_check():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost") as client:
        response = await client.get("/health")
        print(f"STATUS_CODE: {response.status_code}")
        print(f"JSON_BODY: {response.json()}")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        expected = {
            "status": "healthy",
            "service": "solace-api",
            "version": "1.0.0"
        }
        assert response.json() == expected, f"Expected {expected}, got {response.json()}"
        print("ASSERTION PASSED: /health matches specification perfectly.")


if __name__ == "__main__":
    asyncio.run(run_health_check())

