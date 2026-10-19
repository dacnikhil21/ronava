import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { ERROR_CODE_MAP, getPlainErrorMessage, DEFAULT_UNKNOWN_ERROR_MESSAGE } from '../src/utils/errorMessages.js';

console.log('=== RUNNING TEST: SINGLE SHARED ERROR MESSAGE LAYER ===');

// 1. Scan all server files to extract every error code the server can return
const serverDir = path.resolve('server');
const serverFiles = fs.readdirSync(serverDir).filter(f => f.endsWith('.js'));
const serverCodes = new Set();

for (const file of serverFiles) {
  const content = fs.readFileSync(path.join(serverDir, file), 'utf8');

  // Match throw new Error('CODE: ...')
  const throwRegex = /throw\s+new\s+Error\s*\(\s*([`'"])([\s\S]*?)\1\s*\)/g;
  let m;
  while ((m = throwRegex.exec(content)) !== null) {
    const raw = m[2].trim();
    if (raw.includes(':')) {
      const code = raw.split(':')[0].trim();
      if (/^[A-Z0-9_]{3,}$/.test(code)) serverCodes.add(code);
    }
  }

  // Match err.code = '...'
  const codeRegex = /err\.code\s*=\s*['"]([A-Z0-9_]{3,})['"]/g;
  while ((m = codeRegex.exec(content)) !== null) {
    serverCodes.add(m[1]);
  }

  // Match error: '...'
  const jsonErrorRegex = /error\s*:\s*['"]([A-Z0-9_]{3,})['"]/g;
  while ((m = jsonErrorRegex.exec(content)) !== null) {
    serverCodes.add(m[1]);
  }

  // Match code: '...'
  const jsonCodeRegex = /code\s*:\s*['"]([A-Z0-9_]{3,})['"]/g;
  while ((m = jsonCodeRegex.exec(content)) !== null) {
    serverCodes.add(m[1]);
  }

  // Match sendJson(res, 4xx/5xx, ...)
  const sendRegex = /sendJson\s*\(\s*res\s*,\s*([45]\d\d)\s*,\s*(\{[\s\S]*?\})\s*\)/g;
  while ((m = sendRegex.exec(content)) !== null) {
    const body = m[2];
    const errMatch = body.match(/error\s*:\s*['"]([A-Z0-9_]{3,})['"]/);
    if (errMatch) serverCodes.add(errMatch[1]);
    const msgMatch = body.match(/message\s*:\s*[`'"]([\s\S]*?)[`'"]/);
    if (msgMatch && msgMatch[1].includes(':')) {
      const potential = msgMatch[1].split(':')[0].trim();
      if (/^[A-Z0-9_]{3,}$/.test(potential)) serverCodes.add(potential);
    }
  }
}

// Ensure specific user-requested error codes are present in the test set
const mandatoryCodes = [
  'PARENT_CHANNEL_MISSING',
  'ADMIN_CANNOT_SWIPE',
  'DUPLICATE_UTR',
  'INVALID_BENEFICIARY_DETAILS',
  'MISSING_BANK_DETAILS',
  'INVALID_RATE_HIERARCHY',
  'INSUFFICIENT_CHANNEL_BALANCE',
  'DUPLICATE_SWIPE',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_REQUIRED',
  'ACCESS_DENIED',
  'ACCESS_FORBIDDEN',
  'FORBIDDEN_ADMIN_ONLY'
];
mandatoryCodes.forEach(c => serverCodes.add(c));

console.log(`Found ${serverCodes.size} server error codes to verify.`);

// 2. Test each error code: must have a plain-English message (not fallback, no raw codes, no forbidden jargon)
const FORBIDDEN_WORDS = [
  /\bT1\b/i,
  /\bmode\b/i,
  /\bbps\b/i,
  /\bADM001\b/,
  /\bpaise\b/i,
  /\bSQL\b/i,
  /\bPostgreSQL\b/i
];

let checkedCount = 0;
for (const code of Array.from(serverCodes).sort()) {
  const plainMsg = getPlainErrorMessage(code);
  assert.ok(plainMsg, `Code "${code}" must return a message`);
  assert.notEqual(
    plainMsg,
    DEFAULT_UNKNOWN_ERROR_MESSAGE,
    `Error code "${code}" is missing a mapped plain-English message in ERROR_CODE_MAP!`
  );

  // Must not contain the raw uppercase code name itself
  assert.ok(
    !plainMsg.includes(code),
    `Plain English message for "${code}" should not contain the raw code name. Got: "${plainMsg}"`
  );

  // Must not contain unexplained jargon like "mode", "T1", "bps", or internal user IDs
  for (const forbidden of FORBIDDEN_WORDS) {
    assert.ok(
      !forbidden.test(plainMsg),
      `Plain English message for "${code}" contains forbidden term ${forbidden}: "${plainMsg}"`
    );
  }

  checkedCount++;
}
console.log(`✓ All ${checkedCount} error codes have verified plain-English shopkeeper explanations.`);

// 3. Test object-based input resolution ({ error: '...' }, { code: '...' }, { message: '...' })
const testObj1 = { success: false, error: 'ADMIN_CANNOT_SWIPE', message: 'Admin cannot swipe' };
assert.equal(
  getPlainErrorMessage(testObj1),
  ERROR_CODE_MAP['ADMIN_CANNOT_SWIPE']
);

const testObj2 = { code: 'DUPLICATE_UTR', message: 'Duplicate UTR' };
assert.equal(
  getPlainErrorMessage(testObj2),
  ERROR_CODE_MAP['DUPLICATE_UTR']
);

const testObj3 = new Error('PARENT_CHANNEL_MISSING: Parent does not have channel configured');
assert.equal(
  getPlainErrorMessage(testObj3),
  ERROR_CODE_MAP['PARENT_CHANNEL_MISSING']
);

// 4. Test phrase matchers (reserve rule, rate below parent, duplicate slip, token expired, not allowed)
const testReserve = getPlainErrorMessage('You can withdraw at most Rs 1,200.00.');
assert.equal(testReserve, ERROR_CODE_MAP['INSUFFICIENT_CHANNEL_BALANCE']);

const testRate = getPlainErrorMessage('Child rate (150 bps) cannot be lower than parent rate (180 bps).');
assert.equal(testRate, ERROR_CODE_MAP['INVALID_RATE_HIERARCHY']);

const testDuplicateSlip = getPlainErrorMessage('Transaction with reference/slip "SLIP123" already recorded today.');
assert.equal(testDuplicateSlip, ERROR_CODE_MAP['DUPLICATE_SWIPE']);

const testTokenExpired = getPlainErrorMessage('Your session ended. Please log in again.');
assert.equal(testTokenExpired, ERROR_CODE_MAP['AUTH_TOKEN_EXPIRED']);

const testNotAllowed = getPlainErrorMessage('Access Denied: You do not have permission.');
assert.equal(testNotAllowed, ERROR_CODE_MAP['ACCESS_DENIED']);

// 5. Test unknown error returns universal fallback
const testUnknown = getPlainErrorMessage('SOME_COMPLETELY_RANDOM_UNEXPECTED_EXCEPTION_12345');
assert.equal(testUnknown, DEFAULT_UNKNOWN_ERROR_MESSAGE);

const testNull = getPlainErrorMessage(null);
assert.equal(testNull, DEFAULT_UNKNOWN_ERROR_MESSAGE);

console.log('✓ All object formats, phrase matchers, and unknown fallback tests PASSED.');
console.log('🎉 Single shared error-message file is 100% complete and verified!');
