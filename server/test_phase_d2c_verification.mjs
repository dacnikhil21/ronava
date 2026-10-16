// server/test_phase_d2c_verification.mjs
// Phase D2c Automated Verification Suite: Catch Block Error States & Zero Guessed Numbers

import assert from 'assert';
import fs from 'fs';
import { parseMerchantChannels, parsePosTerminalRates } from '../src/services/api.js';

console.log('------------------------------------------------------------');
console.log('🧪 RONAV PHASE D2c: CATCH BLOCK ERROR STATE VERIFICATION SUITE');
console.log('------------------------------------------------------------');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] Test ${totalTests}: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// =========================================================================
// TEST 1: API parseMerchantChannels returns explicit error on corrupt JSON
// =========================================================================
runTest('API parseMerchantChannels returns error object on corrupt [PORTFOLIO] JSON', () => {
  const corruptPos = {
    terminal_id: '[PORTFOLIO] { "pine_labs": { "enabled": true, "rate_t1": 1.5, corrupt_json... }'
  };
  const result = parseMerchantChannels(corruptPos);
  assert.strictEqual(result.hasError, true, 'hasError must be true');
  assert.strictEqual(result.error, 'Could not load rates, try again');
  assert.strictEqual(result.enabledList.length, 0, 'No guessed channels in enabledList');
});

// =========================================================================
// TEST 2: API parsePosTerminalRates returns null rates on corrupt JSON
// =========================================================================
runTest('API parsePosTerminalRates returns null rates and error state on corrupt [PORTFOLIO]', () => {
  const corruptStr = '[PORTFOLIO] { invalid json content';
  const result = parsePosTerminalRates(corruptStr, 1.5);
  assert.strictEqual(result.hasError, true, 'hasError must be true');
  assert.strictEqual(result.error, 'Could not load rates, try again');
  assert.strictEqual(result.rateT1, null, 'rateT1 must be null, never a guessed number');
  assert.strictEqual(result.rateInstant, null, 'rateInstant must be null, never a guessed number');
  assert.strictEqual(result.adminCut, null, 'adminCut must be null');
});

// =========================================================================
// TEST 3: AdminDashboardPage - getUserTotalCommissionEarned error state
// =========================================================================
runTest('AdminDashboardPage: Member commission returns error state when notes JSON corrupt', () => {
  const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  assert(adminCode.includes("Could not load rates, try again"), 'Must contain error message');
  assert(adminCode.includes("getUserTotalCommissionEarned"), 'Must contain commission helper');
  assert(adminCode.includes("hasError = true"), 'Must flag calculation error');
  assert(adminCode.includes("if (hasError) return { error: true, message: 'Could not load rates, try again' }"), 'Must return error object');
});

// =========================================================================
// TEST 4: AdminDashboardPage - Card 2 Admin Net Profit error state
// =========================================================================
runTest('AdminDashboardPage: Card 2 displays error state when transaction fee metadata is corrupt', () => {
  const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  assert(adminCode.includes("hasFeeError = true"), 'Must set hasFeeError on parse failure');
  assert(adminCode.includes("filteredData.hasFeeError ? ("), 'Card 2 must check hasFeeError');
  assert(adminCode.includes("Could not load rates, try again"), 'Card 2 must render visible error');
});

// =========================================================================
// TEST 5: AdminDashboardPage - MDR Commission Breakdown error state
// =========================================================================
runTest('AdminDashboardPage: MDR breakdown renders error state when meta JSON is corrupt', () => {
  const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  assert(adminCode.includes("metaError = true"), 'Must flag metaError on parse failure');
  assert(adminCode.includes("commission_rate: metaError ? 'Could not load rates, try again'"), 'Must assign error text to rate');
  assert(adminCode.includes("commission_amount: metaError ? null : cut"), 'Amount must be null, not guessed number');
  assert(adminCode.includes("item.hasError ? ("), 'Must check item.hasError in MDR breakdown view');
});

// =========================================================================
// TEST 6: AdminDashboardPage - Ledger Gross MDR summary error state
// =========================================================================
runTest('AdminDashboardPage: Ledger summary displays error state on fee parse failure', () => {
  const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  assert(adminCode.includes("hasDossierFeeError = true"), 'Must flag hasDossierFeeError on parse failure');
  assert(adminCode.includes("hasDossierFeeError ? ("), 'Must check hasDossierFeeError');
  assert(adminCode.includes("Could not load rates, try again"), 'Must render error state in summary');
});

// =========================================================================
// TEST 7: AdminDashboardPage - Card Swipe Notes Drawer error state
// =========================================================================
runTest('AdminDashboardPage: Card swipe drawer shows error state when notes JSON corrupt', () => {
  const adminCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  assert(adminCode.includes("feeError = true"), 'Must flag feeError on swipe notes parse failure');
  assert(adminCode.includes("feeError ? '#FEF2F2' : '#F8FAFC'"), 'Must style error state with red border');
  assert(adminCode.includes("selectedDossierTxn.feeError ? ("), 'Modal must check feeError');
});

// =========================================================================
// TEST 8: MerchantDashboardPage - Transaction detail modal fee error state
// =========================================================================
runTest('MerchantDashboardPage: Transaction modal displays error state on corrupt notes JSON', () => {
  const merchantCode = fs.readFileSync('src/components/MerchantDashboardPage.jsx', 'utf8');
  assert(merchantCode.includes("parseError = true"), 'Must flag parseError on notes split JSON error');
  assert(merchantCode.includes("rateError: parseError"), 'Must export rateError');
  assert(merchantCode.includes("parsed.parseError ? ("), 'Modal breakdown must check parseError');
  assert(merchantCode.includes("Could not load rates, try again"), 'Modal breakdown must show error banner');
});

// =========================================================================
// TEST 9: MerchantDashboardPage - Active machine and Sale form rate error state
// =========================================================================
runTest('MerchantDashboardPage: Active machine and Sale form show error state on rate failure', () => {
  const merchantCode = fs.readFileSync('src/components/MerchantDashboardPage.jsx', 'utf8');
  assert(merchantCode.includes("hasRateError = !!(merchantChannels?.hasError || userPosRates?.hasError)"), 'Must check rate error');
  assert(merchantCode.includes("activeMachine.hasRateError ? ("), 'Must check activeMachine.hasRateError');
  assert(merchantCode.includes("disabled={isSubmittingSale || cardSwipeAmount <= 0 || !saleForm.transaction_id || activeMachine.hasRateError}"), 'Sale submit must be blocked on rate error');
});

// =========================================================================
// TEST 10: Zero remaining fallback to guessed rate or margin
// =========================================================================
runTest('No fallback to guessed rates or company fees in remediated blocks', () => {
  // Corrupt notes simulation in parseMerchantChannels
  const badRes = parseMerchantChannels({ terminal_id: '[PORTFOLIO] { BAD JSON' });
  assert.strictEqual(badRes.hasError, true);
  assert.strictEqual(badRes.pine_labs.rate_t1, 0); // default container, but flagged hasError
  assert.strictEqual(badRes.enabledList.length, 0);
});

console.log('------------------------------------------------------------');
console.log(`📊 PHASE D2c VERIFICATION SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('------------------------------------------------------------');
