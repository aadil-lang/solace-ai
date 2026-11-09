// Solace AI — Storage Adapter Compatibility & Security Test Suite
const assert = require('assert');

async function runTests() {
  console.log('--- RUNNING SECURESTORE & STORAGE ADAPTER COMPATIBILITY TEST SUITE ---\n');

  // 1. Replicate sanitizeKey logic from mobile/services/supabaseStorage.ts
  const sanitizeKey = (key) => key.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Mock platform states
  let currentPlatform = 'android';
  const mockNativeStore = new Map();
  const mockWebLocalStorage = new Map();
  let shouldSimulateDiskError = false;

  // Mock Adapter mirroring ExpoSecureStoreAdapter implementation
  const MockStorageAdapter = {
    getItem: async (key) => {
      try {
        if (currentPlatform === 'web') {
          return mockWebLocalStorage.get(key) || null;
        }
        return mockNativeStore.get(sanitizeKey(key)) || null;
      } catch (err) {
        return null;
      }
    },

    setItem: async (key, value) => {
      try {
        if (shouldSimulateDiskError) {
          throw new Error('EACCES: permission denied or disk full');
        }
        if (currentPlatform === 'web') {
          mockWebLocalStorage.set(key, value);
          return;
        }
        mockNativeStore.set(sanitizeKey(key), value);
      } catch (error) {
        throw error;
      }
    },

    removeItem: async (key) => {
      try {
        if (shouldSimulateDiskError) {
          throw new Error('EACCES: permission denied or disk full');
        }
        if (currentPlatform === 'web') {
          mockWebLocalStorage.delete(key);
          return;
        }
        mockNativeStore.delete(sanitizeKey(key));
      } catch (error) {
        throw error;
      }
    },
  };

  // [1/6] Deterministic Key Sanitization
  console.log('[1/6] Testing Deterministic Key Sanitization...');
  const rawKey = '@solace_auth_pending_checkins';
  const sanitized1 = sanitizeKey(rawKey);
  const sanitized2 = sanitizeKey(rawKey);
  assert.strictEqual(sanitized1, '_solace_auth_pending_checkins');
  assert.strictEqual(sanitized1, sanitized2, 'Sanitization must be strictly deterministic across calls.');
  console.log('✓ Deterministic key mapping verified.');

  // [2/6] Android Keystore Character Constraints Compliance
  console.log('\n[2/6] Testing Android Keystore Character Constraints...');
  const keystoreRegex = /^[a-zA-Z0-9._-]+$/;
  const testKeys = [
    '@solace_guest_checkin_index',
    '@solace_guest_checkin_entry_guest_ci_123456789_meta',
    '@solace_guest_checkin_entry_guest_ci_123456789_chunk_0',
    '@solace_guest_journal_index',
    '@solace_guest_journal_entry_guest_vj_987654321_meta',
    '@solace_guest_saved_poems',
    '@solace_auth_pending_checkins',
    'solace_guest_mode_active',
    'sb-wiilbnurygloomjyljbl-auth-token',
  ];

  for (const k of testKeys) {
    const sanitized = sanitizeKey(k);
    assert.match(sanitized, keystoreRegex, `Key "${sanitized}" violates Android Keystore allowed characters.`);
  }
  console.log('✓ All application keys comply with Android Keystore requirements.');

  // [3/6] Key Collision Verification
  console.log('\n[3/6] Testing Collision Resistance Across All Application Keys...');
  const sanitizedSet = new Set();
  for (const k of testKeys) {
    const sanitized = sanitizeKey(k);
    assert.ok(!sanitizedSet.has(sanitized), `Collision detected for key: ${k} -> ${sanitized}`);
    sanitizedSet.add(sanitized);
  }
  assert.strictEqual(sanitizedSet.size, testKeys.length, 'No two application keys may map to the same sanitized key.');
  console.log('✓ Zero collisions detected across all current application keys.');

  // [4/6] Platform Branching (Web vs Native)
  console.log('\n[4/6] Testing Platform Branching (Web localStorage vs Native SecureStore)...');
  // Native Android
  currentPlatform = 'android';
  await MockStorageAdapter.setItem('@solace_test_platform', 'native_value');
  assert.strictEqual(mockNativeStore.get('_solace_test_platform'), 'native_value', 'Native must use sanitized key.');
  assert.strictEqual(await MockStorageAdapter.getItem('@solace_test_platform'), 'native_value');

  // Web platform
  currentPlatform = 'web';
  await MockStorageAdapter.setItem('@solace_test_platform', 'web_value');
  assert.strictEqual(mockWebLocalStorage.get('@solace_test_platform'), 'web_value', 'Web must preserve raw key in localStorage.');
  assert.strictEqual(await MockStorageAdapter.getItem('@solace_test_platform'), 'web_value');
  console.log('✓ Platform branching correctly preserves web raw keys and native sanitized keys.');

  // [5/6] Namespace Isolation
  console.log('\n[5/6] Testing Guest vs Authenticated Namespace Isolation...');
  currentPlatform = 'android';
  await MockStorageAdapter.setItem('@solace_guest_checkin_index', JSON.stringify([{ id: 'guest-1' }]));
  await MockStorageAdapter.setItem('@solace_auth_pending_checkins', JSON.stringify([{ id: 'auth-offline-1' }]));

  const guestData = JSON.parse(await MockStorageAdapter.getItem('@solace_guest_checkin_index'));
  const authData = JSON.parse(await MockStorageAdapter.getItem('@solace_auth_pending_checkins'));

  assert.strictEqual(guestData[0].id, 'guest-1');
  assert.strictEqual(authData[0].id, 'auth-offline-1');
  assert.notDeepStrictEqual(guestData, authData, 'Guest and authenticated offline data must remain partitioned.');
  console.log('✓ Namespace isolation between guest and authenticated offline data verified.');

  // [6/6] Non-Silent Error Propagation on Persistence Failure
  console.log('\n[6/6] Testing Non-Silent Error Propagation on Persistence Failure...');
  shouldSimulateDiskError = true;
  let errorCaught = false;

  try {
    await MockStorageAdapter.setItem('@solace_fail_key', 'fail_value');
  } catch (err) {
    errorCaught = true;
    assert.match(err.message, /EACCES/, 'Underlying storage error must be re-thrown.');
  }

  assert.ok(errorCaught, 'Storage adapter must NOT silently swallow setItem failures.');
  shouldSimulateDiskError = false;
  console.log('✓ Storage failure correctly surfaces to caller instead of falsely claiming success.');

  console.log('\n=============================================================');
  console.log('ALL SECURESTORE & STORAGE ADAPTER COMPATIBILITY TESTS PASSED!');
  console.log('=============================================================\n');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
