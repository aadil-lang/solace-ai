import multiprocessing
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import uvicorn
from app.main import app


def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")


def main():
    print("1. Launching FastAPI Uvicorn server on http://127.0.0.1:8000...")
    server_process = multiprocessing.Process(target=run_server, daemon=True)
    server_process.start()

    time.sleep(2)  # Give server 2 seconds to initialize

    print("2. Running Mobile API Client Integration Script...")
    result = subprocess.run(
        ["node", "mobile/scripts/test-api-client.js"],
        capture_output=True,
        text=True
    )

    print("--- Mobile Client Output ---")
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)

    print("3. Terminating test server...")
    server_process.terminate()
    server_process.join()

    if result.returncode == 0:
        print(">>> END-TO-END MOBILE CLIENT TO BACKEND VERIFICATION SUCCEEDED! <<<")
    else:
        print(">>> VERIFICATION FAILED <<<")
        sys.exit(result.returncode)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()

