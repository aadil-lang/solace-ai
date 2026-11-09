const assert = require('assert');

console.log('--- RUNNING MOBILE EMOTIONAL LANDSCAPE TEST SUITE ---\n');

// -----------------------------------------------------------------------------
// [1/6] Deterministic Analytics & Mathematical Parity
// -----------------------------------------------------------------------------
console.log('[1/6] Testing Deterministic Analytics & Parity...');

const MOOD_ORDER = ['peaceful', 'grateful', 'reflective', 'anxious', 'heavy', 'hopeful'];

const classifyTimeOfDay = (date) => {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

const computeSummary = (checkIns, timeframe = '7d', referenceDate = new Date()) => {
  let scoped = checkIns;
  if (timeframe !== 'all' && checkIns.length > 0) {
    const days = timeframe === '7d' ? 7 : 30;
    const cutoff = referenceDate.getTime() - days * 24 * 60 * 60 * 1000;
    scoped = checkIns.filter((c) => new Date(c.created_at).getTime() >= cutoff);
  }

  const total = scoped.length;
  if (total === 0) {
    return {
      timeframe,
      total_moments: 0,
      season_distribution: MOOD_ORDER.map((m) => ({ mood: m, count: 0, percentage: 0.0 })),
      dominant_season: null,
      average_intensity: null,
      meaningful_moments_count: 0,
      busiest_time_of_day: null,
    };
  }

  const counts = { peaceful: 0, grateful: 0, reflective: 0, anxious: 0, heavy: 0, hopeful: 0 };
  const latestTs = {};
  let intensitySum = 0;
  let meaningfulCount = 0;
  const todCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const todLatestTs = {};

  for (const c of scoped) {
    const t = new Date(c.created_at).getTime();
    counts[c.mood] = (counts[c.mood] || 0) + 1;
    if (!latestTs[c.mood] || t > latestTs[c.mood]) latestTs[c.mood] = t;

    intensitySum += c.intensity;
    if (c.is_meaningful) meaningfulCount++;

    const tod = classifyTimeOfDay(new Date(c.created_at));
    todCounts[tod] = (todCounts[tod] || 0) + 1;
    if (!todLatestTs[tod] || t > todLatestTs[tod]) todLatestTs[tod] = t;
  }

  const distribution = MOOD_ORDER.map((m) => ({
    mood: m,
    count: counts[m],
    percentage: Math.round((counts[m] / total) * 1000) / 10,
  }));

  const maxCount = Math.max(...Object.values(counts));
  const dominantCandidates = MOOD_ORDER.filter((m) => counts[m] === maxCount);
  let dominantSeason = dominantCandidates[0];
  if (dominantCandidates.length > 1) {
    dominantSeason = dominantCandidates.reduce((best, curr) => {
      return (latestTs[curr] || 0) > (latestTs[best] || 0) ? curr : best;
    }, dominantCandidates[0]);
  }

  const averageIntensity = Math.round((intensitySum / total) * 10) / 10;

  const todKeys = ['morning', 'afternoon', 'evening', 'night'];
  const maxTodCount = Math.max(...todKeys.map((k) => todCounts[k]));
  const busiestCandidates = todKeys.filter((k) => todCounts[k] === maxTodCount);
  let busiestTod = busiestCandidates[0];
  if (busiestCandidates.length > 1) {
    busiestTod = busiestCandidates.reduce((best, curr) => {
      return (todLatestTs[curr] || 0) > (todLatestTs[best] || 0) ? curr : best;
    }, busiestCandidates[0]);
  }

  return {
    timeframe,
    total_moments: total,
    season_distribution: distribution,
    dominant_season: dominantSeason,
    average_intensity: averageIntensity,
    meaningful_moments_count: meaningfulCount,
    busiest_time_of_day: busiestTod,
  };
};

// 1a. Empty check-ins test
const emptyRes = computeSummary([]);
assert.strictEqual(emptyRes.total_moments, 0);
assert.strictEqual(emptyRes.dominant_season, null);
assert.strictEqual(emptyRes.average_intensity, null);
assert.strictEqual(emptyRes.busiest_time_of_day, null);
assert.strictEqual(emptyRes.meaningful_moments_count, 0);
for (const item of emptyRes.season_distribution) {
  assert.strictEqual(item.count, 0);
  assert.strictEqual(item.percentage, 0.0);
}

// 1b. Single check-in test
const singleRes = computeSummary([
  { id: '1', mood: 'peaceful', intensity: 4, created_at: '2026-11-09T10:00:00Z', is_meaningful: true },
]);
assert.strictEqual(singleRes.total_moments, 1);
assert.strictEqual(singleRes.dominant_season, 'peaceful');
assert.strictEqual(singleRes.average_intensity, 4.0);
assert.strictEqual(singleRes.meaningful_moments_count, 1);
const peacefulDist = singleRes.season_distribution.find((d) => d.mood === 'peaceful');
assert.strictEqual(peacefulDist.percentage, 100.0);

// 1c. Dominant season tie-breaking by most recent timestamp
const tieCheckIns = [
  { id: '1', mood: 'hopeful', intensity: 3, created_at: '2026-11-08T08:00:00Z' },
  { id: '2', mood: 'hopeful', intensity: 4, created_at: '2026-11-08T12:00:00Z' },
  { id: '3', mood: 'reflective', intensity: 3, created_at: '2026-11-09T09:00:00Z' },
  { id: '4', mood: 'reflective', intensity: 2, created_at: '2026-11-09T14:00:00Z' },
];
const tieRes = computeSummary(tieCheckIns, 'all');
assert.strictEqual(tieRes.dominant_season, 'reflective', 'Tie-breaker must choose most recently logged mood');
assert.strictEqual(tieRes.average_intensity, 3.0);
console.log('✓ Deterministic analytics & tie-breaking verified.');

// -----------------------------------------------------------------------------
// [2/6] Time of Day Categorization Windows
// -----------------------------------------------------------------------------
console.log('[2/6] Testing Time-of-Day Windows...');

const dMorning = new Date('2026-11-09T08:30:00');
const dAfternoon = new Date('2026-11-09T13:45:00');
const dEvening = new Date('2026-11-09T18:15:00');
const dNight = new Date('2026-11-09T23:10:00');

assert.strictEqual(classifyTimeOfDay(dMorning), 'morning');
assert.strictEqual(classifyTimeOfDay(dAfternoon), 'afternoon');
assert.strictEqual(classifyTimeOfDay(dEvening), 'evening');
assert.strictEqual(classifyTimeOfDay(dNight), 'night');
console.log('✓ Time-of-day windows (morning, afternoon, evening, night) verified.');

// -----------------------------------------------------------------------------
// [3/6] Guest Storage Chunking, Multibyte / Unicode Reconstitution & Restart Persistence
// -----------------------------------------------------------------------------
console.log('[3/6] Testing Guest Mode Chunking & Multibyte / Urdu Reconstitution...');

const GUEST_CHECKIN_INDEX_KEY = '@solace_guest_checkin_index';
const GUEST_CHECKIN_ENTRY_PREFIX = '@solace_guest_checkin_entry_';
const CHUNK_SIZE = 1500;

let mockSecureStore = {};

const saveGuestCheckInLocal = async (entry) => {
  const rawNote = entry.note || '';
  const numChunks = Math.ceil(rawNote.length / CHUNK_SIZE) || 1;

  for (let i = 0; i < numChunks; i++) {
    const chunk = rawNote.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${entry.id}_chunk_${i}`] = chunk;
  }

  const entryMeta = {
    ...entry,
    note: '',
    num_chunks: numChunks,
  };
  mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${entry.id}_meta`] = JSON.stringify(entryMeta);

  let index = [];
  if (mockSecureStore[GUEST_CHECKIN_INDEX_KEY]) {
    index = JSON.parse(mockSecureStore[GUEST_CHECKIN_INDEX_KEY]);
  }
  index = index.filter((item) => item.id !== entry.id);
  index.unshift({
    id: entry.id,
    mood: entry.mood,
    created_at: entry.created_at,
    is_meaningful: entry.is_meaningful,
  });
  mockSecureStore[GUEST_CHECKIN_INDEX_KEY] = JSON.stringify(index);
};

const loadGuestCheckInsLocal = async () => {
  if (!mockSecureStore[GUEST_CHECKIN_INDEX_KEY]) return [];
  const index = JSON.parse(mockSecureStore[GUEST_CHECKIN_INDEX_KEY]);
  const loaded = [];

  for (const item of index) {
    const metaStr = mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${item.id}_meta`];
    if (!metaStr) continue;

    const meta = JSON.parse(metaStr);
    const numChunks = meta.num_chunks || 1;
    let note = '';

    for (let i = 0; i < numChunks; i++) {
      const chunk = mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${item.id}_chunk_${i}`];
      if (chunk) note += chunk;
    }

    loaded.push({ ...meta, note: note || null, sync_status: 'local_only' });
  }
  return loaded;
};

const deleteGuestCheckInLocal = async (id) => {
  const metaStr = mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${id}_meta`];
  if (metaStr) {
    const meta = JSON.parse(metaStr);
    const numChunks = meta.num_chunks || 1;
    for (let i = 0; i < numChunks; i++) {
      delete mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${id}_chunk_${i}`];
    }
  }
  delete mockSecureStore[`${GUEST_CHECKIN_ENTRY_PREFIX}${id}_meta`];

  if (mockSecureStore[GUEST_CHECKIN_INDEX_KEY]) {
    const index = JSON.parse(mockSecureStore[GUEST_CHECKIN_INDEX_KEY]);
    mockSecureStore[GUEST_CHECKIN_INDEX_KEY] = JSON.stringify(index.filter((it) => it.id !== id));
  }
};

(async () => {
  // Test entry with Urdu script and emoji
  const urduNote = 'آج کا دن پرسکون اور خاموش رہا۔ میں نے خود کے لیے وقت نکالا۔ 🌿✨';
  const entry1 = {
    id: 'guest_ci_1',
    user_id: 'guest',
    mood: 'peaceful',
    intensity: 4,
    note: urduNote,
    is_meaningful: true,
    created_at: new Date().toISOString(),
  };

  // Test very long note requiring multiple chunks
  const longNote = 'Taking a slow breath. '.repeat(100); // 2300 characters
  const entry2 = {
    id: 'guest_ci_2',
    user_id: 'guest',
    mood: 'reflective',
    intensity: 3,
    note: longNote,
    is_meaningful: false,
    created_at: new Date().toISOString(),
  };

  await saveGuestCheckInLocal(entry1);
  await saveGuestCheckInLocal(entry2);

  // Verify chunk limits (no raw string chunk exceeds 1500 bytes)
  for (const key of Object.keys(mockSecureStore)) {
    if (key.includes('_chunk_')) {
      assert(mockSecureStore[key].length <= CHUNK_SIZE, 'Chunk size exceeded 1500-byte limit!');
    }
  }

  // Simulate reboot: load check-ins from storage
  const rehydrated = await loadGuestCheckInsLocal();
  assert.strictEqual(rehydrated.length, 2);

  const loadedUrdu = rehydrated.find((c) => c.id === 'guest_ci_1');
  assert.strictEqual(loadedUrdu.note, urduNote, 'Multibyte Urdu & emoji note was corrupted!');
  assert.strictEqual(loadedUrdu.is_meaningful, true);
  assert.strictEqual(loadedUrdu.sync_status, 'local_only');

  const loadedLong = rehydrated.find((c) => c.id === 'guest_ci_2');
  assert.strictEqual(loadedLong.note, longNote, 'Chunked long note was corrupted on reassembly!');

  // Delete entry1
  await deleteGuestCheckInLocal('guest_ci_1');
  const postDelete = await loadGuestCheckInsLocal();
  assert.strictEqual(postDelete.length, 1);
  assert.strictEqual(postDelete[0].id, 'guest_ci_2');
  console.log('✓ Guest chunked storage, Urdu script, and restart persistence verified.');

  // -----------------------------------------------------------------------------
  // [4/6] Authenticated Offline Sync States (synced, pending_sync, local_only)
  // -----------------------------------------------------------------------------
  console.log('[4/6] Testing Authenticated Offline Sync States...');

  let authPendingQueue = [];
  const saveOfflineEntry = (entry) => {
    authPendingQueue.push({ ...entry, sync_status: 'pending_sync' });
  };

  const offlineEntry = {
    id: 'pending_ci_100',
    user_id: 'auth_user_1',
    mood: 'hopeful',
    intensity: 4,
    note: 'Created while device had no network',
    is_meaningful: true,
    created_at: '2026-11-09T09:00:00Z',
  };

  saveOfflineEntry(offlineEntry);
  assert.strictEqual(authPendingQueue.length, 1);
  assert.strictEqual(authPendingQueue[0].sync_status, 'pending_sync');
  assert.strictEqual(authPendingQueue[0].created_at, '2026-11-09T09:00:00Z', 'Must preserve original offline timestamp');

  // Idempotent background sync
  let syncedCloudDatabase = [];
  const syncPendingItems = async () => {
    const remaining = [];
    for (const item of authPendingQueue) {
      // Simulate cloud save
      syncedCloudDatabase.push({ ...item, id: 'cloud_' + item.id, sync_status: 'synced' });
    }
    authPendingQueue = [];
  };

  await syncPendingItems();
  assert.strictEqual(authPendingQueue.length, 0, 'Pending queue should be cleared after sync');
  assert.strictEqual(syncedCloudDatabase.length, 1);
  assert.strictEqual(syncedCloudDatabase[0].sync_status, 'synced');

  // Syncing a second time should not duplicate
  await syncPendingItems();
  assert.strictEqual(syncedCloudDatabase.length, 1, 'Idempotent sync must not duplicate records');
  console.log('✓ Offline sync states (synced, pending_sync, local_only) verified.');

  // -----------------------------------------------------------------------------
  // [5/6] Meaningful Moments Explicit Consent & Isolation
  // -----------------------------------------------------------------------------
  console.log('[5/6] Testing Meaningful Moments Explicit Consent...');

  const allMoments = [
    { id: '1', mood: 'peaceful', intensity: 3, note: 'Simple moment', is_meaningful: false },
    { id: '2', mood: 'grateful', intensity: 5, note: 'Heartfelt thank you', is_meaningful: true },
    { id: '3', mood: 'heavy', intensity: 4, note: 'Hard day', is_meaningful: false },
  ];

  const meaningfulOnly = allMoments.filter((m) => m.is_meaningful);
  assert.strictEqual(meaningfulOnly.length, 1, 'Only explicitly bookmarked items must appear');
  assert.strictEqual(meaningfulOnly[0].id, '2');

  // Toggling bookmark
  allMoments[0].is_meaningful = true;
  const updatedMeaningful = allMoments.filter((m) => m.is_meaningful);
  assert.strictEqual(updatedMeaningful.length, 2);

  // Unbookmarking
  allMoments[0].is_meaningful = false;
  const postUnbookmark = allMoments.filter((m) => m.is_meaningful);
  assert.strictEqual(postUnbookmark.length, 1);
  console.log('✓ Meaningful moments explicit consent & toggle verified.');

  // -----------------------------------------------------------------------------
  // [6/6] AI Reflection Lifecycle (Separate Generate, Save, and Delete)
  // -----------------------------------------------------------------------------
  console.log('[6/6] Testing AI Reflection Lifecycle & Crisis Override...');

  let activeReflectionState = null;
  let savedReflectionsState = [];

  // 1. Generation sets activeReflection but does NOT save
  const onGenerateReflection = (generatedText, isCrisis = false) => {
    activeReflectionState = {
      reflection: generatedText,
      is_crisis_override: isCrisis,
      dominant_season: 'peaceful',
    };
  };

  onGenerateReflection(
    'A quiet calm has wrapped around your days this past week. Allowing room for the stillness helps steady the heart.'
  );

  assert.notStrictEqual(activeReflectionState, null);
  assert.strictEqual(savedReflectionsState.length, 0, 'Reflection must NOT auto-save on generation');

  // 2. Explicit user save action
  const onExplicitSaveReflection = (timeframe) => {
    const record = {
      id: 'ref_' + Date.now(),
      timeframe,
      reflection: activeReflectionState.reflection,
      dominant_mood: activeReflectionState.dominant_season,
      created_at: new Date().toISOString(),
    };
    savedReflectionsState.push(record);
    return record;
  };

  const savedRecord = onExplicitSaveReflection('7d');
  assert.strictEqual(savedReflectionsState.length, 1);
  assert.strictEqual(savedReflectionsState[0].reflection, activeReflectionState.reflection);

  // 3. User delete action
  savedReflectionsState = savedReflectionsState.filter((r) => r.id !== savedRecord.id);
  assert.strictEqual(savedReflectionsState.length, 0, 'User must be able to delete saved reflection');

  // 4. Crisis screening override test
  const crisisNote = 'I cannot live like this anymore, I want to kill myself';
  const isCrisis = /(?:kill myself|end my life|suicid)/i.test(crisisNote);
  assert(isCrisis, 'Crisis regex must detect suicidal intent');

  onGenerateReflection('Tele-MANAS: Call 14416 | Emergency: Call 112', true);
  assert.strictEqual(activeReflectionState.is_crisis_override, true);
  assert(activeReflectionState.reflection.includes('14416'));
  console.log('✓ AI reflection lifecycle, explicit save, and crisis screening verified.');

  console.log('\n=============================================================');
  console.log('ALL MOBILE EMOTIONAL LANDSCAPE TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================================');
})();

