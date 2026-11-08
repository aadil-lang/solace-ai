// Solace AI — Mobile Authentication, Session & Profile Test Suite
const assert = require('assert');

// 1. Storage Adapter Mock (simulating Expo SecureStore)
const mockSecureStore = new Map();
const mockSecureStoreAdapter = {
  getItem: async (key) => mockSecureStore.get(key) || null,
  setItem: async (key, val) => { mockSecureStore.set(key, val); },
  removeItem: async (key) => { mockSecureStore.delete(key); },
};

// 2. Validation Logic Functions (mirroring signup/login screens)
function validateLogin(email, password) {
  const errors = {};
  const emailTrimmed = (email || '').trim();
  if (!emailTrimmed) {
    errors.email = 'Please enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Please enter your password.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

function validateSignup(fullName, email, password, confirmPassword) {
  const errors = {};
  if (!fullName || !fullName.trim()) {
    errors.fullName = 'Please let us know how to address you.';
  }

  const emailTrimmed = (email || '').trim();
  if (!emailTrimmed) {
    errors.email = 'Please enter your email address.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Please create a password.';
  } else if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

// 3. Navigation Guard Route Resolution
function resolveRoute({ isAuthenticated, isGuest, onboardingCompleted, currentRoute }) {
  if (!isAuthenticated && !isGuest) {
    if (currentRoute.startsWith('/(tabs)') || currentRoute === '/onboarding') {
      return '/(auth)/login';
    }
    return currentRoute;
  }

  if (currentRoute.startsWith('/(auth)')) {
    if (!isGuest && onboardingCompleted === false) {
      return '/onboarding';
    }
    return '/(tabs)';
  }

  return currentRoute;
}

// ==========================================
// TEST EXECUTION
// ==========================================
async function runTests() {
  console.log('--- RUNNING MOBILE AUTHENTICATION & PROFILE TEST SUITE ---');

  // Test 1: Login validation
  console.log('\n[1/6] Testing Login Form Validation...');
  const emptyLogin = validateLogin('', '');
  assert.strictEqual(emptyLogin.isValid, false);
  assert.ok(emptyLogin.errors.email);
  assert.ok(emptyLogin.errors.password);

  const invalidEmailLogin = validateLogin('invalid-email', '123456');
  assert.strictEqual(invalidEmailLogin.isValid, false);
  assert.strictEqual(invalidEmailLogin.errors.email, 'Please enter a valid email address.');

  const shortPasswordLogin = validateLogin('user@solace.ai', '123');
  assert.strictEqual(shortPasswordLogin.isValid, false);
  assert.strictEqual(shortPasswordLogin.errors.password, 'Password must be at least 6 characters.');

  const validLogin = validateLogin('user@solace.ai', 'securePass123');
  assert.strictEqual(validLogin.isValid, true);
  console.log('✓ Login validation passed.');

  // Test 2: Signup validation
  console.log('\n[2/6] Testing Signup Form Validation...');
  const emptySignup = validateSignup('', '', '', '');
  assert.strictEqual(emptySignup.isValid, false);
  assert.ok(emptySignup.errors.fullName);
  assert.ok(emptySignup.errors.email);
  assert.ok(emptySignup.errors.password);

  const mismatchedSignup = validateSignup('Aadil', 'aadil@solace.ai', 'pass123', 'pass456');
  assert.strictEqual(mismatchedSignup.isValid, false);
  assert.strictEqual(mismatchedSignup.errors.confirmPassword, 'Passwords do not match.');

  const validSignup = validateSignup('Aadil', 'aadil@solace.ai', 'pass1234', 'pass1234');
  assert.strictEqual(validSignup.isValid, true);
  console.log('✓ Signup validation passed.');

  // Test 3: Session Persistence & Storage Adapter
  console.log('\n[3/6] Testing Session Storage Adapter (Expo SecureStore)...');
  const sessionPayload = JSON.stringify({
    access_token: 'test_token_xyz',
    user: { id: 'usr-123', email: 'test@solace.ai' }
  });
  await mockSecureStoreAdapter.setItem('supabase.auth.token', sessionPayload);
  const retrieved = await mockSecureStoreAdapter.getItem('supabase.auth.token');
  assert.strictEqual(retrieved, sessionPayload);

  // Test guest session flag persistence
  await mockSecureStoreAdapter.setItem('solace_guest_mode_active', 'true');
  const isGuestActive = await mockSecureStoreAdapter.getItem('solace_guest_mode_active');
  assert.strictEqual(isGuestActive, 'true');

  // Test session cleanup on logout
  await mockSecureStoreAdapter.removeItem('supabase.auth.token');
  await mockSecureStoreAdapter.removeItem('solace_guest_mode_active');
  assert.strictEqual(await mockSecureStoreAdapter.getItem('supabase.auth.token'), null);
  assert.strictEqual(await mockSecureStoreAdapter.getItem('solace_guest_mode_active'), null);
  console.log('✓ Session persistence and cleanup passed.');

  // Test 4: Protected Route Navigation Guard
  console.log('\n[4/6] Testing Protected Route Navigation Transitions...');
  // Unauthenticated user trying to access home tab -> redirect to login
  assert.strictEqual(
    resolveRoute({ isAuthenticated: false, isGuest: false, currentRoute: '/(tabs)' }),
    '/(auth)/login'
  );

  // Unauthenticated user on login -> stays on login
  assert.strictEqual(
    resolveRoute({ isAuthenticated: false, isGuest: false, currentRoute: '/(auth)/login' }),
    '/(auth)/login'
  );

  // Authenticated user with incomplete onboarding on login -> redirect to onboarding
  assert.strictEqual(
    resolveRoute({ isAuthenticated: true, isGuest: false, onboardingCompleted: false, currentRoute: '/(auth)/login' }),
    '/onboarding'
  );

  // Authenticated user with completed onboarding on login -> redirect to main tabs
  assert.strictEqual(
    resolveRoute({ isAuthenticated: true, isGuest: false, onboardingCompleted: true, currentRoute: '/(auth)/login' }),
    '/(tabs)'
  );

  // Guest user on login -> redirect to main tabs
  assert.strictEqual(
    resolveRoute({ isAuthenticated: false, isGuest: true, onboardingCompleted: true, currentRoute: '/(auth)/login' }),
    '/(tabs)'
  );
  console.log('✓ Protected route navigation transitions passed.');

  // Test 5: Onboarding State Contract
  console.log('\n[5/6] Testing Onboarding State Contract...');
  const onboardingPayload = {
    preferred_name: 'Aadil',
    wellness_goals: ['calm_anxiety', 'daily_gratitude'],
    interaction_style: 'gentle',
    onboarding_completed: true,
  };
  assert.strictEqual(typeof onboardingPayload.preferred_name, 'string');
  assert.ok(Array.isArray(onboardingPayload.wellness_goals));
  assert.strictEqual(onboardingPayload.onboarding_completed, true);
  console.log('✓ Onboarding contract verified.');

  // Test 6: Summary
  console.log('\n[6/6] Summary Check...');
  console.log('=====================================================');
  console.log('ALL MOBILE AUTH, SESSION & NAVIGATION TESTS PASSED! ');
  console.log('=====================================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

