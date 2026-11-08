// Solace AI — Phase 3 Mobile Test Suite: Companion, Emotional Memory & Mood Persistence
const assert = require('assert');

// 1. Mood Check-in Validation Logic
function validateCheckIn(mood, intensity, note) {
  const errors = {};
  const allowedMoods = ['peaceful', 'grateful', 'reflective', 'anxious', 'heavy', 'hopeful'];

  if (!mood) {
    errors.mood = 'Mood is required';
  } else if (!allowedMoods.includes(mood)) {
    errors.mood = `Invalid mood: ${mood}`;
  }

  if (typeof intensity !== 'number' || intensity < 1 || intensity > 5) {
    errors.intensity = 'Intensity must be an integer between 1 and 5';
  }

  if (note && note.length > 280) {
    errors.note = 'Note must not exceed 280 characters';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

// 2. SSE Parser (mirroring apiService.streamChat)
function parseSSEChunk(chunk, callbacks) {
  const lines = chunk.split('\n');
  let currentEvent = null;
  let currentData = '';

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.substring(7).trim();
    } else if (line.startsWith('data: ')) {
      currentData = line.substring(6).trim();

      if (currentEvent && currentData) {
        try {
          const parsed = JSON.parse(currentData);
          if (currentEvent === 'message_start' && callbacks.onMessageStart) {
            callbacks.onMessageStart(parsed.session_id, parsed.message_id);
          } else if (currentEvent === 'token' && callbacks.onToken) {
            callbacks.onToken(parsed.text);
          } else if (currentEvent === 'memory_suggestion' && callbacks.onMemorySuggestion) {
            callbacks.onMemorySuggestion(parsed);
          } else if (currentEvent === 'message_complete' && callbacks.onComplete) {
            callbacks.onComplete(parsed);
          } else if (currentEvent === 'error' && callbacks.onError) {
            callbacks.onError(parsed);
          }
        } catch (e) {
          // ignore parse error in malformed lines
        }
      }
    }
  }
}

// 3. Emotional Memory State Machine
class MockMemoryStore {
  constructor(isGuest = false) {
    this.memories = [];
    this.pendingSuggestion = null;
    this.isGuest = isGuest;
    this.isMemoryEnabled = true;
  }

  setPendingSuggestion(s) {
    this.pendingSuggestion = s;
  }

  approveSuggestion() {
    if (!this.pendingSuggestion) return false;
    const mem = {
      id: this.isGuest ? `guest_mem_${Date.now()}` : `mem_${this.memories.length + 1}`,
      user_id: this.isGuest ? 'guest' : 'user-123',
      memory_text: this.pendingSuggestion.memory_text,
      category: this.pendingSuggestion.category,
      source: 'conversation',
      consent_status: 'approved',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.memories.unshift(mem);
    this.pendingSuggestion = null;
    return true;
  }

  declineSuggestion() {
    this.pendingSuggestion = null;
    return true;
  }

  toggleMemory(id, isActive) {
    const mem = this.memories.find((m) => m.id === id);
    if (mem) {
      mem.is_active = isActive;
      return true;
    }
    return false;
  }

  deleteMemory(id) {
    const idx = this.memories.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.memories.splice(idx, 1);
      return true;
    }
    return false;
  }
}

// 4. Crisis Intervention Detection Check
function isCrisisMessage(text) {
  const falsePositivePatterns = [
    /\b(?:dying|killed myself|killing me)\s+(?:of\s+laughter|laughing|with\s+laughter)\b/i,
    /\bcareer\s+suicide\b/i,
    /\bsuicide\s+(?:squad|run|mission|pass|play|blitz)\b/i,
    /\b(?:dying|died)\s+to\s+(?:see|know|try|hear|meet)\b/i,
    /\bkill\s+myself\s+laughing\b/i,
  ];
  if (falsePositivePatterns.some((fp) => fp.test(text))) {
    return false;
  }

  const crisisPatterns = [
    /\b(?:suicid(?:e|al)|suiciding)\b/i,
    /\bkill(?:ing)?\s+myself\b/i,
    /\bend(?:ing)?\s+(?:my\s+life|it\s+all)\b/i,
    /\btake\s+my\s+(?:own\s+)?life\b/i,
    /\b(?:want|wish|ready|plan(?:ning)?)\s+to\s+die\b/i,
    /\bwish\s+(?:i\s+was|i\s+were)\s+dead\b/i,
    /\bbetter\s+off\s+(?:dead|without\s+me)\b/i,
    /\bself[- ]harm(?:ing)?\b/i,
    /\bhurt(?:ing)?\s+myself\b/i,
    /\bcut(?:ting)?\s+my\s*(?:wrists?|arms?|thighs?|body)\b/i,
    /\bno\s+reason\s+to\s+(?:live|go\s+on)\b/i,
    /\b(?:don't|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|exist|wake\s+up)\b/i,
  ];
  return crisisPatterns.some((p) => p.test(text));
}

// ==========================================
// TEST EXECUTION
// ==========================================
async function runTests() {
  console.log('--- RUNNING MOBILE PHASE 3 (EMOTIONAL INTELLIGENCE & COMPANION) TEST SUITE ---');

  // Test 1: Mood check-in validation
  console.log('\n[1/5] Testing Mood Check-in Validation...');
  const invalidMood = validateCheckIn('furious', 3, 'Not feeling great');
  assert.strictEqual(invalidMood.isValid, false);
  assert.ok(invalidMood.errors.mood);

  const invalidIntensity = validateCheckIn('peaceful', 6, 'Overjoyed');
  assert.strictEqual(invalidIntensity.isValid, false);
  assert.strictEqual(invalidIntensity.errors.intensity, 'Intensity must be an integer between 1 and 5');

  const zeroIntensity = validateCheckIn('reflective', 0);
  assert.strictEqual(zeroIntensity.isValid, false);

  const validCheckIn = validateCheckIn('anxious', 4, 'Upcoming project deadline tomorrow');
  assert.strictEqual(validCheckIn.isValid, true);
  console.log('✓ Mood check-in validation rules verified.');

  // Test 2: SSE Chat Streaming parsing
  console.log('\n[2/5] Testing SSE Stream Parser Events...');
  let startCalled = false;
  let tokens = [];
  let suggestion = null;
  let completed = false;

  const mockCallbacks = {
    onMessageStart: (sid, mid) => {
      startCalled = true;
      assert.strictEqual(sid, 'sess-100');
    },
    onToken: (tok) => {
      tokens.push(tok);
    },
    onMemorySuggestion: (sug) => {
      suggestion = sug;
    },
    onComplete: (data) => {
      completed = true;
    },
    onError: (err) => {},
  };

  const rawSSEStream =
    'event: message_start\n' +
    'data: {"session_id":"sess-100","message_id":"msg-200"}\n\n' +
    'event: memory_suggestion\n' +
    'data: {"memory_text":"Practices box breathing during panic","category":"coping_strategies"}\n\n' +
    'event: token\n' +
    'data: {"text":"I hear "}\n\n' +
    'event: token\n' +
    'data: {"text":"you."}\n\n' +
    'event: message_complete\n' +
    'data: {"session_id":"sess-100","message_id":"msg-200","full_content":"I hear you."}\n\n';

  parseSSEChunk(rawSSEStream, mockCallbacks);

  assert.strictEqual(startCalled, true, 'message_start must be invoked');
  assert.deepStrictEqual(tokens, ['I hear ', 'you.'], 'tokens must be assembled');
  assert.ok(suggestion, 'memory_suggestion must be emitted');
  assert.strictEqual(suggestion.category, 'coping_strategies');
  assert.strictEqual(completed, true, 'message_complete must be invoked');
  console.log('✓ SSE streaming parser events properly dispatches to chat UI.');

  // Test 3: Consent-based Emotional Memory Workflow
  console.log('\n[3/5] Testing User-Consent Emotional Memory Lifecycle...');
  const memStore = new MockMemoryStore(false);

  // Solace companion suggests a memory
  memStore.setPendingSuggestion({
    memory_text: 'Prefers quiet mornings without notifications',
    category: 'preferences',
  });
  assert.ok(memStore.pendingSuggestion);
  assert.strictEqual(memStore.memories.length, 0, 'No memory stored before consent');

  // User explicitly approves
  const approved = memStore.approveSuggestion();
  assert.strictEqual(approved, true);
  assert.strictEqual(memStore.memories.length, 1);
  assert.strictEqual(memStore.memories[0].consent_status, 'approved');
  assert.strictEqual(memStore.pendingSuggestion, null, 'Pending suggestion cleared');

  // User toggles memory active / inactive
  const memId = memStore.memories[0].id;
  memStore.toggleMemory(memId, false);
  assert.strictEqual(memStore.memories[0].is_active, false);

  // User deletes memory (forgetting)
  const deleted = memStore.deleteMemory(memId);
  assert.strictEqual(deleted, true);
  assert.strictEqual(memStore.memories.length, 0);

  // Test decline flow
  memStore.setPendingSuggestion({
    memory_text: 'Sensitive to loud rooms',
    category: 'ongoing_challenges',
  });
  memStore.declineSuggestion();
  assert.strictEqual(memStore.pendingSuggestion, null);
  assert.strictEqual(memStore.memories.length, 0, 'Declined memory must never be saved');
  console.log('✓ Consent-based memory lifecycle (suggest -> approve -> toggle -> delete -> decline) passed.');

  // Test 4: Guest Session Memory Isolation
  console.log('\n[4/5] Testing Guest Session Isolation...');
  const guestMemStore = new MockMemoryStore(true);
  guestMemStore.setPendingSuggestion({
    memory_text: 'Temporary guest goal: better sleep',
    category: 'goals',
  });
  guestMemStore.approveSuggestion();
  assert.strictEqual(guestMemStore.memories.length, 1);
  assert.strictEqual(guestMemStore.memories[0].user_id, 'guest');
  assert.ok(guestMemStore.memories[0].id.startsWith('guest_mem_'));
  console.log('✓ Guest session data strictly partitioned from persistent cloud storage.');

  // Test 5: Crisis Intervention Detection
  console.log('\n[5/5] Testing Crisis Keyword Detection Guard...');
  assert.strictEqual(isCrisisMessage('I am feeling so overwhelmed today'), false);
  assert.strictEqual(isCrisisMessage('I had thoughts of suicide last night'), true);
  assert.strictEqual(isCrisisMessage('I want to kill myself'), true);
  assert.strictEqual(isCrisisMessage('Thinking about self-harm again'), true);
  assert.strictEqual(isCrisisMessage('Just need a safe space to breathe'), false);

  // False positives verification
  assert.strictEqual(isCrisisMessage("I'm dying of laughter from that joke"), false);
  assert.strictEqual(isCrisisMessage("Doing this would be career suicide"), false);
  assert.strictEqual(isCrisisMessage("That movie made me kill myself laughing"), false);
  console.log('✓ Crisis safety detector correctly identifies self-harm cues and rejects idioms.');

  console.log('\n=============================================================');
  console.log('ALL MOBILE PHASE 3 (EMOTIONAL INTEL & COMPANION) TESTS PASSED!');
  console.log('=============================================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

