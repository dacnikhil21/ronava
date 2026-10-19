import assert from 'assert';
import { getPlainErrorMessage, DEFAULT_UNKNOWN_ERROR_MESSAGE } from '../src/utils/errorMessages.js';
import fs from 'fs';

function testFixBBackgroundAndSpecificErrors() {
  console.log('=== TEST FIX B: Background Error Isolation & Specific User Messages ===');

  // 1. Verify getPlainErrorMessage maps specific server error phrases without falling back to generic unknown
  const specificPhrases = [
    { input: 'Shortfall: ₹500.00', expectedIncludes: 'reserve' },
    { input: 'You can withdraw at most Rs 1,200.00.', expectedIncludes: '1,200' },
    { input: 'Account numbers do not match!', expectedIncludes: 'match' },
    { input: 'Bank UTR or transfer reference number is required', expectedIncludes: 'reference' }
  ];

  for (const item of specificPhrases) {
    const output = getPlainErrorMessage(item.input);
    console.log(`Checking plain mapping for "${item.input}" -> "${output}"`);
    assert.notEqual(output, DEFAULT_UNKNOWN_ERROR_MESSAGE, `Specific error "${item.input}" must not fall back to generic catch-all`);
  }

  // 2. Verify MerchantDashboardPage.jsx does not trigger showToast on background sync
  const code = fs.readFileSync('src/components/MerchantDashboardPage.jsx', 'utf8');

  // In fetchLiveData, ensure it does not call showToast on sync failure
  const fetchLiveDataIdx = code.indexOf('const fetchLiveData = async');
  const fetchLiveDataBlock = code.slice(fetchLiveDataIdx, fetchLiveDataIdx + 2500);

  const hasToastInFetchLiveData = fetchLiveDataBlock.includes('showToast(');
  assert.equal(hasToastInFetchLiveData, false, 'fetchLiveData background loader must NOT call showToast');

  // In background profile sync (~line 793), ensure it does not show toast on transient background failure
  const profileSyncIdx = code.indexOf('// Dynamic User Profile Sync');
  const profileSyncBlock = code.slice(profileSyncIdx, profileSyncIdx + 1500);
  const badGenericToast = profileSyncBlock.includes("showToast(json.message || '⚠️ Account suspended");
  assert.equal(badGenericToast, false, 'Background profile sync must not show generic toast on transient non-suspended failure');

  console.log('✅ TEST FIX B PASSED: Background data loads are decoupled from scary toasts; user messages are specific.');
}

try {
  testFixBBackgroundAndSpecificErrors();
} catch (err) {
  console.error('❌ TEST FIX B FAILED:', err.message);
  process.exit(1);
}
