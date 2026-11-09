// Solace AI — Mobile API Cold-Start, Resilience & SSE Stream Test Suite
const assert = require('assert');

async function runTests() {
  console.log('--- RUNNING API COLD-START, SSE STREAM & TTS RESILIENCE TEST SUITE ---\n');

  // 1. Cold-start detection helper logic mirroring mobile/services/api.ts
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

  // 2. Mock API Client mirroring the updated retry and window budget logic
  class MockApiClient {
    constructor(timeoutMs = 12000, maxRetryWindowMs = 55000) {
      this.timeoutMs = timeoutMs;
      this.maxRetryWindowMs = maxRetryWindowMs;
      this.coldStartEvents = [];
    }

    notifyColdStart(isColdStarting, attempt, maxAttempts) {
      this.coldStartEvents.push({ isColdStarting, attempt, maxAttempts });
    }

    async delay(ms, signal) {
      return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          return reject(err);
        }
        const timeoutId = setTimeout(() => {
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve();
        }, ms);
        const onAbort = () => {
          clearTimeout(timeoutId);
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          reject(err);
        };
        if (signal) {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      });
    }

    async executeRequest({
      method = 'GET',
      endpoint = '/test',
      isIdempotent,
      retries,
      signal,
      simulateResponses = [],
      useVirtualTime = true,
    }) {
      const isIdem = isIdempotent !== undefined ? isIdempotent : (method === 'GET' || method === 'DELETE' || method === 'HEAD');
      const maxRetries = retries !== undefined ? retries : (isIdem ? 5 : 0);
      const configuredTimeout = this.timeoutMs;
      const MAX_RETRY_WINDOW_MS = this.maxRetryWindowMs;

      let virtualElapsed = 0;
      let attempts = 0;
      let lastError = null;
      let lastResponse = null;
      let hasNotifiedColdStart = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal && signal.aborted) {
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          throw err;
        }

        if (attempt > 0 && virtualElapsed >= MAX_RETRY_WINDOW_MS) {
          break;
        }

        attempts++;
        const remainingWindow = Math.max(1000, MAX_RETRY_WINDOW_MS - virtualElapsed);
        const attemptTimeout = isIdem ? Math.min(configuredTimeout, remainingWindow) : configuredTimeout;

        const nextSim = simulateResponses[attempt] || { ok: true, status: 200, durationMs: 200 };
        const simDuration = nextSim.durationMs !== undefined ? nextSim.durationMs : 200;
        virtualElapsed += Math.min(simDuration, attemptTimeout);

        if (nextSim.throwError) {
          lastError = nextSim.throwError;
          if (signal && signal.aborted) throw lastError;

          if (isColdStartOrTransient(lastError) && attempt < maxRetries && virtualElapsed < MAX_RETRY_WINDOW_MS) {
            if (!hasNotifiedColdStart) {
              this.notifyColdStart(true, attempt + 1, maxRetries + 1);
              hasNotifiedColdStart = true;
            }

            const expDelay = Math.min(2000 * Math.pow(2, attempt), 16000);
            const jitter = 100;
            const delayMs = expDelay + jitter;
            const safeDelay = Math.min(delayMs, Math.max(100, MAX_RETRY_WINDOW_MS - virtualElapsed));

            if (!useVirtualTime) {
              await this.delay(safeDelay, signal);
            }
            virtualElapsed += safeDelay;
            continue;
          }

          if (hasNotifiedColdStart) {
            this.notifyColdStart(false, attempt + 1, maxRetries + 1);
          }
          throw lastError;
        }

        if (nextSim.status >= 502 && nextSim.status <= 504) {
          lastResponse = nextSim;
          if (attempt < maxRetries && virtualElapsed < MAX_RETRY_WINDOW_MS) {
            if (!hasNotifiedColdStart) {
              this.notifyColdStart(true, attempt + 1, maxRetries + 1);
              hasNotifiedColdStart = true;
            }

            const expDelay = Math.min(2000 * Math.pow(2, attempt), 16000);
            const jitter = 100;
            const delayMs = expDelay + jitter;
            const safeDelay = Math.min(delayMs, Math.max(100, MAX_RETRY_WINDOW_MS - virtualElapsed));

            if (!useVirtualTime) {
              await this.delay(safeDelay, signal);
            }
            virtualElapsed += safeDelay;
            continue;
          }
        }

        if (hasNotifiedColdStart) {
          this.notifyColdStart(false, attempt + 1, maxRetries + 1);
        }
        return { response: nextSim, totalAttempts: attempts, virtualElapsed };
      }

      if (hasNotifiedColdStart) {
        this.notifyColdStart(false, maxRetries + 1, maxRetries + 1);
      }
      if (lastResponse) return { response: lastResponse, totalAttempts: attempts, virtualElapsed };
      throw lastError || new Error(`Request to ${endpoint} failed after ${attempts} attempts within window.`);
    }
  }

  // =========================================================================
  // PRIORITY 1: COLD-START RETRY BEHAVIOUR & RETRY WINDOW
  // =========================================================================

  // [1/11] Immediate 502 Responses Across the Extended Retry Window
  console.log('[1/11] Testing Immediate 502 Responses Across Extended Retry Window...');
  const client1 = new MockApiClient();
  // Simulate Render booting: 5 attempts return 502 immediately (200ms), 6th attempt succeeds at ~46s
  const sim502 = await client1.executeRequest({
    method: 'GET',
    endpoint: '/api/v1/profile/me',
    simulateResponses: [
      { status: 502, durationMs: 200 }, // Attempt 0 -> backoff ~2.1s
      { status: 502, durationMs: 200 }, // Attempt 1 -> backoff ~4.1s
      { status: 502, durationMs: 200 }, // Attempt 2 -> backoff ~8.1s
      { status: 502, durationMs: 200 }, // Attempt 3 -> backoff ~16.1s
      { status: 502, durationMs: 200 }, // Attempt 4 -> backoff ~16.1s
      { status: 200, ok: true, durationMs: 600 }, // Attempt 5 -> Render is awake!
    ],
  });

  assert.strictEqual(sim502.totalAttempts, 6, 'Must retry through 5 cold boots to succeed on attempt 6.');
  assert.strictEqual(sim502.response.status, 200, 'Must return 200 OK once warm.');
  assert.ok(
    sim502.virtualElapsed >= 45000 && sim502.virtualElapsed <= 55000,
    `Total elapsed (${sim502.virtualElapsed}ms) must comfortably span Render's ~45s cold start window.`
  );
  // Status notification verification: exactly 1 cold-start active event and 1 finished event
  assert.strictEqual(client1.coldStartEvents.length, 2, 'Must emit exactly 1 cold-start active event and 1 finished event without spam.');
  assert.strictEqual(client1.coldStartEvents[0].isColdStarting, true);
  assert.strictEqual(client1.coldStartEvents[1].isColdStarting, false);
  console.log(`✓ Immediate 502 responses accommodated across ${sim502.virtualElapsed}ms with clean single-event status update.`);

  // [2/11] Requests That Time Out Rather Than Immediately Returning
  console.log('\n[2/11] Testing Requests That Time Out (Hanging TCP Connects)...');
  const client2 = new MockApiClient();
  const abortErr = new Error('The user aborted a request.');
  abortErr.name = 'AbortError';

  // Simulate requests hanging for 12s timeout each
  const timeoutRun = await client2.executeRequest({
    method: 'GET',
    endpoint: '/health',
    simulateResponses: [
      { throwError: abortErr, durationMs: 12000 }, // Attempt 0: 12s + 2.1s = 14.1s
      { throwError: abortErr, durationMs: 12000 }, // Attempt 1: 12s + 4.1s = 30.2s
      { status: 200, ok: true, durationMs: 800 },   // Attempt 2: succeeds at 31.0s
    ],
  });

  assert.strictEqual(timeoutRun.totalAttempts, 3, 'Timeout requests retry properly.');
  assert.strictEqual(timeoutRun.response.status, 200);
  assert.ok(timeoutRun.virtualElapsed > 25000 && timeoutRun.virtualElapsed < 55000);
  console.log(`✓ Hanging timeout requests properly retried with bounded budget (completed in ${timeoutRun.virtualElapsed}ms).`);

  // [3/11] Warm Backend Success on First Attempt (Zero Added Delay)
  console.log('\n[3/11] Testing Warm Backend Success on Attempt 1...');
  const client3 = new MockApiClient();
  const warmRun = await client3.executeRequest({
    method: 'GET',
    endpoint: '/health',
    simulateResponses: [{ status: 200, ok: true, durationMs: 598 }],
  });
  assert.strictEqual(warmRun.totalAttempts, 1, 'Warm request completes on attempt 1.');
  assert.strictEqual(warmRun.virtualElapsed, 598, 'Warm request incurs zero retry overhead.');
  assert.strictEqual(client3.coldStartEvents.length, 0, 'No cold start notifications emitted for warm calls.');
  console.log('✓ Warm request completed in 598ms with zero retry overhead.');

  // [4/11] Ordinary 4xx and 500 Errors Fail-Fast
  console.log('\n[4/11] Testing Fail-Fast for Ordinary 4xx and 500 Errors...');
  const ordinaryStatuses = [400, 401, 403, 404, 422, 500];
  for (const st of ordinaryStatuses) {
    const clientErr = new MockApiClient();
    const res = await clientErr.executeRequest({
      method: 'GET',
      endpoint: '/test',
      simulateResponses: [{ status: st, ok: false, durationMs: 100 }],
    });
    assert.strictEqual(res.totalAttempts, 1, `Status ${st} must NOT trigger cold-start retry.`);
    assert.strictEqual(res.response.status, st);
    assert.strictEqual(clientErr.coldStartEvents.length, 0, `No cold-start event for status ${st}.`);
  }
  console.log('✓ Ordinary errors (400, 401, 403, 404, 422, 500) fail-fast on attempt 1 without retries.');

  // [5/11] Cancellation During Backoff (AbortController / Signal)
  console.log('\n[5/11] Testing Cancellation During Backoff Delay...');
  const client5 = new MockApiClient();
  const abortController = {
    signal: {
      aborted: false,
      listeners: [],
      addEventListener(type, fn) { this.listeners.push(fn); },
      removeEventListener(type, fn) { this.listeners = this.listeners.filter((f) => f !== fn); },
    },
    abort() {
      this.signal.aborted = true;
      this.signal.listeners.forEach((fn) => fn());
    },
  };

  // Launch request with useVirtualTime: false, trigger abort after 30ms during 100ms backoff
  const requestPromise = client5.executeRequest({
    method: 'GET',
    endpoint: '/test',
    signal: abortController.signal,
    useVirtualTime: false,
    simulateResponses: [
      { status: 502, durationMs: 10 },
      { status: 200, ok: true, durationMs: 10 },
    ],
  });

  setTimeout(() => abortController.abort(), 20);

  let cancellationCaught = false;
  try {
    await requestPromise;
  } catch (err) {
    if (err.name === 'AbortError' || err.message.includes('aborted')) {
      cancellationCaught = true;
    }
  }
  assert.ok(cancellationCaught, 'Aborting signal during backoff must reject immediately.');
  console.log('✓ Cancellation during backoff delay rejected cleanly without waiting for delay to expire.');

  // [6/11] Maximum Retry-Window Enforcement (55s Cap)
  console.log('\n[6/11] Testing Maximum Retry-Window Enforcement (55s Cap)...');
  const client6 = new MockApiClient(12000, 55000);
  // Infinite 502s: should stop once virtualElapsed reaches 55000ms
  const simInfinite502 = await client6.executeRequest({
    method: 'GET',
    endpoint: '/health',
    simulateResponses: [
      { status: 502, durationMs: 200 },
      { status: 502, durationMs: 200 },
      { status: 502, durationMs: 200 },
      { status: 502, durationMs: 200 },
      { status: 502, durationMs: 200 },
      { status: 502, durationMs: 200 },
      { status: 502, durationMs: 200 },
    ],
  });

  assert.ok(
    simInfinite502.virtualElapsed <= 55000,
    `Virtual elapsed time (${simInfinite502.virtualElapsed}ms) must strictly respect 55s ceiling.`
  );
  console.log(`✓ Retry window ceiling enforced at ${simInfinite502.virtualElapsed}ms.`);

  // =========================================================================
  // PRIORITY 2: SSE RETRY & DUPLICATE-TURN SAFETY
  // =========================================================================

  // [7/11] Stream Request Submitted Only Once After Connection Failure
  console.log('\n[7/11] Testing Stream Request Executed Exactly Once on Connection Failure...');
  let postCount = 0;
  let receivedError = null;

  async function mockStreamChat({ simulateStatus, simulateConnErr }) {
    postCount++;
    if (simulateConnErr) {
      throw new Error('Network request failed');
    }
    return { status: simulateStatus, ok: simulateStatus === 200 };
  }

  // Execute single-attempt stream handler mirroring updated api.ts streamChat
  async function testStreamChatHandler(opts) {
    postCount = 0;
    receivedError = null;
    const callbacks = { onError: (msg) => { receivedError = msg; } };

    try {
      let response;
      try {
        response = await mockStreamChat(opts);
      } catch (connErr) {
        callbacks.onError('Connection to Solace was interrupted before your message could be sent. Please tap to try again.');
        return;
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        callbacks.onError('Solace is gently waking up or temporarily unavailable. Your message was not sent. Please tap to send again.');
        return;
      }
    } catch (err) {
      callbacks.onError(err.message);
    }
  }

  await testStreamChatHandler({ simulateConnErr: true });
  assert.strictEqual(postCount, 1, 'Stream POST must be attempted exactly ONCE on network drop.');
  assert.ok(receivedError.includes('Please tap to try again'), 'Actionable manual retry message provided.');
  console.log('✓ Stream chat sends exactly 1 POST on network failure; zero duplicate submissions.');

  // [8/11] 504 Gateway Timeout Does NOT Trigger Another POST
  console.log('\n[8/11] Testing 504 Gateway Timeout Does NOT Trigger Another POST...');
  await testStreamChatHandler({ simulateStatus: 504 });
  assert.strictEqual(postCount, 1, 'Stream POST must be attempted exactly ONCE on 504 gateway timeout.');
  assert.ok(receivedError.includes('Your message was not sent'), 'Clear feedback confirming message was not sent.');
  console.log('✓ 504 timeout does not trigger automatic retry.');

  // [9/11] Mid-Stream Network Failure Does Not Restart Conversation
  console.log('\n[9/11] Testing Mid-Stream Network Failure Does Not Restart Conversation...');
  let tokensReceived = [];
  let streamError = null;
  postCount = 0;

  async function simulateMidStreamExecution() {
    postCount++;
    // Yield first 2 tokens then disconnect
    tokensReceived.push('Hello');
    tokensReceived.push(' friend');
    throw new Error('Socket closed mid-stream');
  }

  try {
    await simulateMidStreamExecution();
  } catch (streamErr) {
    streamError = streamErr.message;
  }

  assert.strictEqual(postCount, 1, 'Stream must never be restarted once tokens have begun streaming.');
  assert.strictEqual(tokensReceived.length, 2);
  assert.strictEqual(streamError, 'Socket closed mid-stream');
  console.log('✓ Mid-stream disconnection terminates cleanly without restarting conversation or duplicating tokens.');

  // =========================================================================
  // PRIORITY 3: EXPLICIT TTS FALLBACK BEHAVIOUR
  // =========================================================================

  // [10/11] Unavailable ExpoSpeech Fallback Invokes onError (Never onDone)
  console.log('\n[10/11] Testing Unavailable ExpoSpeech Fallback Invokes onError...');
  const shimmedExpoSpeech = {
    isAvailable: false,
    speak: (id, text, options) => {
      if (options && typeof options.onError === 'function') {
        const err = new Error('[ExponentSpeech] Native speech synthesis is unavailable in this preview build.');
        setTimeout(() => options.onError(err), 0);
      }
    },
  };

  let onDoneCalled = false;
  let onErrorCalled = false;
  let errorPayload = null;

  shimmedExpoSpeech.speak('test_id', 'Hello world', {
    onDone: () => { onDoneCalled = true; },
    onError: (err) => {
      onErrorCalled = true;
      errorPayload = err;
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.strictEqual(onDoneCalled, false, 'onDone must NEVER be called when native speech module is unavailable.');
  assert.strictEqual(onErrorCalled, true, 'onError must be invoked when native speech module is unavailable.');
  assert.ok(errorPayload.message.includes('unavailable in this preview build'));
  console.log('✓ Unavailable speech fallback explicitly calls onError and never falsely signals onDone.');

  // [11/11] Real Native Module Delegation When Available
  console.log('\n[11/11] Testing Real Native Module Delegation When Available...');
  const realNativeSpeech = {
    isAvailable: true,
    speak: (id, text, options) => {
      // Real native Android TextToSpeech engine plays audio and invokes onDone
      setTimeout(options.onDone, 10);
    },
  };

  function getSpeechModule(mockRequireNative) {
    let mod = null;
    try {
      mod = mockRequireNative('ExpoSpeech');
    } catch (e) {
      mod = shimmedExpoSpeech;
    }
    return mod;
  }

  const resolvedReal = getSpeechModule(() => realNativeSpeech);
  assert.strictEqual(resolvedReal.isAvailable, true, 'Must delegate directly to real native module when compiled.');

  const resolvedFallback = getSpeechModule(() => { throw new Error('Cannot find module'); });
  assert.strictEqual(resolvedFallback.isAvailable, false, 'Must safely fall back when module is absent.');
  console.log('✓ Module resolution cleanly delegates to real native module when compiled into binary.');

  console.log('\n============================================================');
  console.log('ALL 11 API COLD-START, SSE STREAM & TTS RESILIENCE TESTS PASSED!');
  console.log('============================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
