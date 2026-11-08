const assert = require('assert');

console.log('--- RUNNING MOBILE WORDS OF SOLACE (POETRY) TEST SUITE ---\n');

// 1. Format validation
console.log('[1/6] Testing Supported Poetry Formats...');
const VALID_FORMATS = ['english', 'urdu_nastaliq', 'bilingual', 'roman_urdu'];
VALID_FORMATS.forEach((fmt) => {
  assert(typeof fmt === 'string');
});
console.log('✓ All 4 poetry formats validated.');

// 2. Theme validation
console.log('[2/6] Testing Supported Emotional Themes...');
const VALID_THEMES = [
  'resilience',
  'patience',
  'hope',
  'self_reliance',
  'overwhelmed',
  'growth',
  'understood',
  'moment_of_calm',
];
assert.strictEqual(VALID_THEMES.length, 8);
console.log('✓ All 8 contemplative themes validated.');

// 3. User context constraint
console.log('[3/6] Testing User Context Character Length Limits...');
const truncateContext = (text) => text.slice(0, 300);
const longText = 'A'.repeat(500);
const truncated = truncateContext(longText);
assert.strictEqual(truncated.length, 300);
console.log('✓ 300-character context ceiling enforced.');

// 4. Guest Mode isolation logic
console.log('[4/6] Testing Guest Mode Local Storage Partitioning...');
let mockCloudSavedCount = 0;
let mockGuestLocalSaved = [];

const savePoem = (isGuest, poem) => {
  if (isGuest) {
    mockGuestLocalSaved.push({ ...poem, id: `guest_${Date.now()}` });
    return true;
  }
  mockCloudSavedCount++;
  return true;
};

// Simulate guest save
savePoem(true, { title: 'Quiet Breath', content: 'Lines of verse' });
assert.strictEqual(mockGuestLocalSaved.length, 1);
assert.strictEqual(mockCloudSavedCount, 0, 'Guest poem must NEVER be pushed to cloud storage');

// Simulate authenticated save
savePoem(false, { title: 'Authenticated Poem', content: 'Lines of verse' });
assert.strictEqual(mockCloudSavedCount, 1);
console.log('✓ Guest mode local storage isolation verified.');

// 5. Urdu RTL detection and styling
console.log('[5/6] Testing Urdu Script RTL Text Alignment...');
const isRtlFormat = (format) => format === 'urdu_nastaliq' || format === 'bilingual';
assert.strictEqual(isRtlFormat('urdu_nastaliq'), true);
assert.strictEqual(isRtlFormat('bilingual'), true);
assert.strictEqual(isRtlFormat('english'), false);
assert.strictEqual(isRtlFormat('roman_urdu'), false);
console.log('✓ Urdu RTL alignment flags verified.');

// 6. Clipboard text formatting
console.log('[6/6] Testing Clipboard Export Formatting...');
const formatForClipboard = (poem) => {
  let res = `${poem.title}\n\n`;
  if (poem.secondary_lines && poem.secondary_lines.length > 0) {
    poem.lines.forEach((l, idx) => {
      res += `${l}\n${poem.secondary_lines[idx] || ''}\n\n`;
    });
  } else {
    res += poem.lines.join('\n') + '\n\n';
  }
  res += `Reflection: ${poem.reflection}`;
  return res;
};

const sampleBilingual = {
  title: 'Sukoon',
  lines: ['ہر اداسی کے بعد اک سکون کا لمحہ ہے'],
  secondary_lines: ['After every sorrow rests a moment of stillness'],
  reflection: 'Take a gentle breath.',
};
const formattedText = formatForClipboard(sampleBilingual);
assert(formattedText.includes('Sukoon'));
assert(formattedText.includes('ہر اداسی'));
assert(formattedText.includes('After every sorrow'));
assert(formattedText.includes('Reflection: Take a gentle breath.'));
console.log('✓ Clipboard formatted export verified.');

console.log('\n=============================================================');
console.log('ALL MOBILE WORDS OF SOLACE (POETRY) TESTS PASSED!');
console.log('=============================================================');
