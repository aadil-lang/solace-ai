import multiprocessing
import os
import sys
import time
import urllib.request
import json

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uvicorn
from app.main import app


def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


def main():
    print("Starting Uvicorn live server in background process...")
    server_process = multiprocessing.Process(target=run_server, daemon=True)
    server_process.start()

    # Wait for server to bind
    max_wait = 10
    start_time = time.time()
    healthy = False

    while time.time() - start_time < max_wait:
        try:
            req = urllib.request.Request("http://127.0.0.1:8000/health")
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    print("Received response from live server:")
                    print(json.dumps(data, indent=2))
                    assert data["status"] == "healthy"
                    assert data["service"] == "solace-api"
                    assert data["version"] == "1.0.0"
                    healthy = True
                    break
        except Exception as e:
            time.sleep(0.5)

    server_process.terminate()
    server_process.join()

    if healthy:
        print("LIVE SERVER HEALTH CHECK PASSED!")
    else:
        print("FAILED to connect to live server within timeout")
        sys.exit(1)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()

