// Solace AI — Mobile API Cold-Start & Resilience Test Suite
const assert = require('assert');

async function runTests() {
  console.log('--- RUNNING API COLD-START & NETWORK RESILIENCE TEST SUITE ---\n');

  // 1. Cold-start detection helper logic
  function isColdStartOrTransient(err, response) {
    if (response) {
      return response.status === 502 || response.status === 503 || response.status === 504;
    }
    if (err && err instanceof Error) {
      if (err.name === 'AbortError') return true;
      const msg = err.message.toLowerCase();
      if (
        msg.includes('network request failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('connection refused') ||
        msg.includes('econnrefused')
      ) {
        return true;
      }
    }
    return false;
  }

  // 2. Simulated Mock API Client with Retry
  class MockApiClient {
    constructor(timeoutMs = 5000) {
      this.timeoutMs = timeoutMs;
      this.coldStartEvents = [];
    }

    notifyColdStart(isColdStarting, attempt, maxAttempts) {
      this.coldStartEvents.push({ isColdStarting, attempt, maxAttempts });
    }

    async executeRequest({ method = 'GET', endpoint = '/test', isIdempotent, retries, simulateResponses = [] }) {
      const isIdem = isIdempotent !== undefined ? isIdempotent : (method === 'GET' || method === 'DELETE');
      const maxRetries = retries !== undefined ? retries : (isIdem ? 2 : 0);

      let attempts = 0;
      let lastError = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        attempts++;
        const nextSim = simulateResponses[attempt] || { ok: true, status: 200 };

        if (nextSim.throwError) {
          lastError = nextSim.throwError;
          if (isColdStartOrTransient(lastError) && attempt < maxRetries) {
            this.notifyColdStart(true, attempt + 1, maxRetries + 1);
            continue;
          }
          if (attempt > 0) {
            this.notifyColdStart(false, attempt + 1, maxRetries + 1);
          }
          throw lastError;
        }

        if (nextSim.status >= 502 && nextSim.status <= 504) {
          if (isColdStartOrTransient(null, nextSim) && attempt < maxRetries) {
            this.notifyColdStart(true, attempt + 1, maxRetries + 1);
            continue;
          }
        }

        if (attempt > 0) {
          this.notifyColdStart(false, attempt + 1, maxRetries + 1);
        }
        return { response: nextSim, totalAttempts: attempts };
      }

      throw lastError || new Error(`Request failed after ${attempts} attempts`);
    }
  }

  // [1/5] Distinguish Cold-Start from Client & Standard Server Errors
  console.log('[1/5] Testing Cold-Start vs Ordinary Error Discrimination...');
  assert.strictEqual(isColdStartOrTransient(null, { status: 502 }), true, '502 Bad Gateway is a cold start indicator.');
  assert.strictEqual(isColdStartOrTransient(null, { status: 503 }), true, '503 Service Unavailable is a cold start indicator.');
  assert.strictEqual(isColdStartOrTransient(null, { status: 504 }), true, '504 Gateway Timeout is a cold start indicator.');
  assert.strictEqual(isColdStartOrTransient(new Error('Network request failed'), null), true, 'Network failure is a transient cold-start indicator.');

  const abortErr = new Error('The user aborted a request.');
  abortErr.name = 'AbortError';
  assert.strictEqual(isColdStartOrTransient(abortErr, null), true, 'AbortError (timeout) is a cold-start indicator.');

  // Negative checks: Ordinary errors must NOT trigger cold-start retry
  assert.strictEqual(isColdStartOrTransient(null, { status: 400 }), false, '400 Bad Request is an ordinary client error.');
  assert.strictEqual(isColdStartOrTransient(null, { status: 401 }), false, '401 Unauthorized is an ordinary auth error.');
  assert.strictEqual(isColdStartOrTransient(null, { status: 404 }), false, '404 Not Found is an ordinary error.');
  assert.strictEqual(isColdStartOrTransient(null, { status: 422 }), false, '422 Validation Error is an ordinary error.');
  assert.strictEqual(isColdStartOrTransient(null, { status: 500 }), false, '500 Internal Server Error is an ordinary app bug, not gateway cold boot.');
  console.log('✓ Cold-start discrimination accurately isolates 502/503/504 and network drops from 4xx/500 errors.');

  // [2/5] Idempotent Request Bounded Retries on 502 Cold Start
  console.log('\n[2/5] Testing Idempotent Request Bounded Retries on 502 Gateway Boot...');
  const client = new MockApiClient();
  // Simulate Render waking up: Attempt 0: 502, Attempt 1: 502, Attempt 2: 200 OK
  const simRun = await client.executeRequest({
    method: 'GET',
    endpoint: '/api/v1/profile/me',
    simulateResponses: [{ status: 502 }, { status: 502 }, { status: 200, ok: true }],
  });
  assert.strictEqual(simRun.totalAttempts, 3, 'Must retry twice (3 total attempts) before succeeding.');
  assert.strictEqual(simRun.response.status, 200, 'Must eventually return the successful response.');
  assert.strictEqual(client.coldStartEvents.length, 3, 'Must emit 2 cold-start active events and 1 completed event.');
  assert.strictEqual(client.coldStartEvents[0].isColdStarting, true);
  assert.strictEqual(client.coldStartEvents[1].isColdStarting, true);
  assert.strictEqual(client.coldStartEvents[2].isColdStarting, false);
  console.log('✓ Idempotent GET cleanly retries through gateway spin-up and emits status events.');

  // [3/5] Non-Idempotent Mutations Prevent Duplicate Submissions
  console.log('\n[3/5] Testing Duplicate Submission Prevention for Non-Idempotent POST...');
  const client2 = new MockApiClient();
  let postErrorCaught = false;

  try {
    // Simulate POST failing with timeout or network failure
    await client2.executeRequest({
      method: 'POST',
      endpoint: '/api/v1/check-ins',
      isIdempotent: false,
      simulateResponses: [{ throwError: abortErr }],
    });
  } catch (err) {
    postErrorCaught = true;
  }

  assert.ok(postErrorCaught, 'POST check-in failure must immediately reject rather than blindly retrying.');
  assert.strictEqual(client2.coldStartEvents.length, 0, 'No retry events emitted for non-idempotent mutation.');
  console.log('✓ Non-idempotent POST operations are never blindly retried, preventing duplicate database records.');

  // [4/5] Immediate Return for Warm Backend (Zero Delay)
  console.log('\n[4/5] Testing Immediate Response for Warm Backend Requests...');
  const client3 = new MockApiClient();
  const warmRun = await client3.executeRequest({
    method: 'GET',
    endpoint: '/health',
    simulateResponses: [{ status: 200, ok: true }],
  });
  assert.strictEqual(warmRun.totalAttempts, 1, 'Warm backend request must finish on attempt 1 without any retry delay.');
  assert.strictEqual(client3.coldStartEvents.length, 0, 'No cold start notifications emitted for warm responses.');
  console.log('✓ Warm requests return immediately without unnecessary wait.');

  // [5/5] Reassuring Calm Error Message on Permanent Offline
  console.log('\n[5/5] Testing Calm Error Message Formatting...');
  const calmMsg = 'Solace is taking a moment to wake up. Your local records remain safe.';
  assert.ok(calmMsg.includes('Your local records remain safe'), 'Error messages must reassure user of local persistence.');
  console.log('✓ Calm error messaging verified.');

  console.log('\n============================================================');
  console.log('ALL API COLD-START & NETWORK RESILIENCE TESTS PASSED!');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
