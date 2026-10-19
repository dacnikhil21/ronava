import assert from 'assert';
import { getCleanTerminalId } from '../src/services/api.js';

function testFixCCleanTerminal() {
  console.log('=== TEST FIX C: Clean Terminal Display Sanitization ===');

  const rawPortfolioJson = '[PORTFOLIO]{"pine_labs":{"enabled":true,"terminal_id":"sd","vendor":"Rose Navaneetham Enterprises","plan":"RENTAL","rent":"499.00","rate_t1":"1.40","rate_instant":"1.50"},"payswiff":{"enabled":true,"terminal_id":"fvdfv","vendor":"RONAV Technologies","plan":"RENTAL","rent":"499.00","rate_t1":"1.60","rate_instant":"1.70"},"qr":{"enabled":true,"vendor":"RONAV Technologies","rate_instant":"1.80"}}';

  // 1. Sanitizing Pine Labs terminal ID from raw portfolio string
  const cleanPine = getCleanTerminalId(rawPortfolioJson, 'pinelabs');
  console.log('Clean Pine Labs TID:', cleanPine);
  assert.equal(cleanPine, 'sd', 'Must extract clean Pine Labs terminal ID');
  assert.equal(cleanPine.includes('{'), false, 'Clean TID must not contain JSON braces');
  assert.equal(cleanPine.includes('[PORTFOLIO]'), false, 'Clean TID must not contain [PORTFOLIO]');

  // 2. Sanitizing Payswiff terminal ID from raw portfolio string
  const cleanSwiff = getCleanTerminalId(rawPortfolioJson, 'payswiff');
  console.log('Clean Payswiff TID:', cleanSwiff);
  assert.equal(cleanSwiff, 'fvdfv', 'Must extract clean Payswiff terminal ID');
  assert.equal(cleanSwiff.includes('{'), false, 'Clean TID must not contain JSON braces');

  // 3. Sanitizing plain string or pipe formatted string
  assert.equal(getCleanTerminalId('PL-9921|T1:1.5|INS:1.8'), 'PL-9921', 'Must strip pipe rates');
  assert.equal(getCleanTerminalId('PL-1001'), 'PL-1001', 'Must pass plain TID intact');

  // 4. Fallback for corrupt JSON
  assert.equal(getCleanTerminalId('[PORTFOLIO]{corrupt', 'pinelabs', 'PL-01'), 'PL-01', 'Must fallback cleanly on invalid JSON');

  console.log('✅ TEST FIX C PASSED: Raw JSON is completely purged from terminal ID display.');
}

try {
  testFixCCleanTerminal();
} catch (err) {
  console.error('❌ TEST FIX C FAILED:', err.message);
  process.exit(1);
}
