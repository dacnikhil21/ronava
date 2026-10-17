import http from 'http';
import assert from 'assert/strict';
import { handleApiRequest } from './api.js';
import { cleanAndReseed } from './clean_and_reseed.mjs';
import { getDbPool } from './pg_db.js';

const TEST_PORT = 5992;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTest() {
  console.log('=== TEST: Reject Caller Identification Enforcement ===');

  // 1. Clean & reseed database with 6 reference users
  await cleanAndReseed();

  const server = http.createServer(async (req, res) => {
    await handleApiRequest(req, res);
  });

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    const { getTestAuthToken } = await import('./test_config.js');
    const midToken = getTestAuthToken('MID4001');
    const admToken = getTestAuthToken('ADM001');

    // 2. Record a swipe as MID4001
    console.log('1. Recording swipe as MID4001...');
    const swipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${midToken}`
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        notes: 'Test swipe for reject verification'
      })
    });
    const swipeJson = await swipeRes.json();
    assert.equal(swipeRes.status, 200);
    const txnId = swipeJson.transaction.id;
    console.log('   Recorded txn ID:', txnId);

    // 3. Attempt to reject transaction with NO token or spoofed header
    console.log('2. Attempting to reject transaction with NO caller token...');
    const rejectNoAuthRes = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-caller-id': 'ADM001' // Spoofed header must be ignored
      },
      body: JSON.stringify({
        txn_id: txnId,
        action: 'REJECT',
        remark: 'Attempting unauthenticated reject'
      })
    });
    const rejectNoAuthJson = await rejectNoAuthRes.json();
    console.log('   Response status:', rejectNoAuthRes.status);
    console.log('   Response body:', rejectNoAuthJson);

    assert.equal(rejectNoAuthRes.status, 401, 'Must return 401 without Bearer token');
    assert.match(
      rejectNoAuthJson.message || '',
      /AUTH_TOKEN_MISSING/,
      'Server must return AUTH_TOKEN_MISSING error'
    );
    console.log('   ✓ Rejected as expected with 401 AUTH_TOKEN_MISSING');

    // 4. Attempt to reject transaction through the real screen request layer (with ADM001 Bearer token)
    console.log('3. Rejecting transaction as authenticated ADM001...');
    const rejectAuthRes = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admToken}`
      },
      body: JSON.stringify({
        txn_id: txnId,
        action: 'REJECT',
        remark: 'Verified reject by Super Admin'
      })
    });
    const rejectAuthJson = await rejectAuthRes.json();
    console.log('   Response status:', rejectAuthRes.status);
    console.log('   Response body:', rejectAuthJson);

    assert.equal(rejectAuthRes.status, 200, 'Must succeed when authenticated as ADM001');
    assert.equal(rejectAuthJson.success, true);
    assert.equal(rejectAuthJson.transaction.status, 'REVERSED');

    // 5. Query financial_ledger to verify created_by is ADM001 on the reversal entries
    console.log('4. Verifying financial_ledger reversal entries have created_by = ADM001...');
    const pool = getDbPool();
    const ledgerRows = await pool.query(
      `SELECT type, amount_paise, created_by FROM financial_ledger WHERE reference_id = $1 ORDER BY id DESC`,
      [txnId]
    );

    console.log('   Ledger entries count:', ledgerRows.rows.length);
    const reversalRows = ledgerRows.rows.filter(r => r.type.includes('reversal') || r.created_by === 'ADM001');
    assert.ok(reversalRows.length > 0, 'Reversal rows must exist');
    for (const r of reversalRows) {
      assert.equal(r.created_by, 'ADM001', `Actor must be ADM001, got ${r.created_by}`);
    }
    console.log('   ✓ Verified all reversal entries were created by ADM001');

    console.log('\n✅ ALL REJECT CALLER AUTH TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  });
