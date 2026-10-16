import assert from 'node:assert/strict';
import http from 'node:http';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { handleApiRequest } from './api.js';

const PORT = 5998;

async function testWithdrawalsAndExport() {
  console.log('=== TEST SUITE: Phase D1b Withdrawal Lifecycle, Excel Export & UTR ===');
  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();

  let benId1;
  try {
    // 1. Setup Admin and Merchant
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('ADM001', 'Admin', '9999000001', 'ADMIN'),
        ('MID5001', 'Payout Merchant', '9999000005', 'MERCHANT')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Setup wallet with balance of Rs 50,000 (5,000,000 paise)
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise)
      VALUES ('MID5001', 5000000, 0)
      ON CONFLICT (user_id) DO UPDATE SET balance_paise = 5000000, held_paise = 0;
    `);

    // Setup rates for merchant
    await setUserRate(client, { userId: 'MID5001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    await setUserRate(client, { userId: 'MID5001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 180 });

    // Setup an approved beneficiary
    benId1 = 'BEN-5001-01';
    await client.query(`
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified)
      VALUES ($1, 'MID5001', 'HDFC Bank', '123456789012', 'HDFC0001234', 'Payout Merchant Store', TRUE)
      ON CONFLICT (id) DO NOTHING;
    `, [benId1]);

    // Record an initial swipe with T1 mode so merchant has swipe history with T1
    await client.query(`
      INSERT INTO transactions (id, merchant_id, amount_paise, customer_charge_paise, net_amount_paise, type, channel, settlement_mode, status)
      VALUES ('TXN-SWIPE-T1', 'MID5001', 1000000, 15000, 985000, 'POS_SWIPE', 'pinelabs', 'T1', 'APPROVED');
    `);
  } finally {
    client.release();
  }

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test HTTP server listening on http://127.0.0.1:${PORT}`);

  try {
    // -----------------------------------------------------------------
    // TEST 1: Create Withdrawal in INSTANT mode (mismatch with swipe T1)
    // -----------------------------------------------------------------
    console.log('1. Creating withdrawal request with INSTANT mode (Rs 5,000)...');
    const wthRes1 = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 5000,
        channel: 'pinelabs',
        settlement_type: 'INSTANT',
        beneficiary_id: benId1
      })
    });
    const wthData1 = await wthRes1.json();
    assert.equal(wthRes1.status, 200, `Withdrawal request must succeed: ${JSON.stringify(wthData1)}`);
    const wthId1 = wthData1.withdrawal.id;
    assert.equal(wthData1.withdrawal.status, 'PENDING');
    assert.equal(wthData1.withdrawal.settlement_type, 'INSTANT');

    // Create a second withdrawal in T1 mode (matching swipe T1)
    console.log('2. Creating second withdrawal request with T1 mode (Rs 3,000)...');
    const wthRes2 = await fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID5001',
        amount: 3000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        beneficiary_id: benId1
      })
    });
    const wthData2 = await wthRes2.json();
    assert.equal(wthRes2.status, 200);
    const wthId2 = wthData2.withdrawal.id;

    // -----------------------------------------------------------------
    // TEST 2: Admin GET /api/admin/withdrawals returns mode and mismatch flag
    // -----------------------------------------------------------------
    console.log('3. Checking GET /api/admin/withdrawals returns swipe_mode and mismatch_flag...');
    const listRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals`);
    const listData = await listRes.json();
    assert.equal(listRes.status, 200);

    const item1 = listData.withdrawals.find(w => w.id === wthId1);
    const item2 = listData.withdrawals.find(w => w.id === wthId2);

    assert(item1, 'Withdrawal 1 must be in list');
    assert(item2, 'Withdrawal 2 must be in list');
    assert.equal(item1.withdrawal_mode, 'INSTANT');
    assert.equal(item1.swipe_mode, 'T1');
    assert.equal(item1.mismatch_flag, true, 'Withdrawal 1 (INSTANT vs T1 swipe) must have mismatch_flag = true');

    assert.equal(item2.withdrawal_mode, 'T1');
    assert.equal(item2.swipe_mode, 'T1');
    assert.equal(item2.mismatch_flag, false, 'Withdrawal 2 (T1 vs T1 swipe) must have mismatch_flag = false');

    // -----------------------------------------------------------------
    // TEST 3: Excel export moves PENDING requests to SUBMITTED_TO_BANK
    // -----------------------------------------------------------------
    console.log('4. Exporting withdrawals to Excel (batch creation)...');
    const exportRes1 = await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawalIds: [wthId1, wthId2],
        batchTag: 'BATCH-2026-001',
        bankName: 'HDFC Bank'
      })
    });
    const exportData1 = await exportRes1.json();
    assert.equal(exportRes1.status, 200, `Export must succeed: ${JSON.stringify(exportData1)}`);
    assert.equal(exportData1.exportedCount, 2);

    // Verify in database that status is now SUBMITTED_TO_BANK
    const dbClient = await pool.connect();
    try {
      const checkW1 = (await dbClient.query('SELECT status, batch_id, submitted_to_bank_at FROM withdrawals WHERE id = $1', [wthId1])).rows[0];
      assert.equal(checkW1.status, 'SUBMITTED_TO_BANK', 'Status must be SUBMITTED_TO_BANK');
      assert(checkW1.batch_id, 'batch_id must be populated');
      assert(checkW1.submitted_to_bank_at, 'submitted_to_bank_at must be populated');
    } finally {
      dbClient.release();
    }

    // -----------------------------------------------------------------
    // TEST 4: Exporting twice is REJECTED (same request cannot be exported again)
    // -----------------------------------------------------------------
    console.log('5. Attempting to export already-submitted requests (must be rejected)...');
    const exportRes2 = await fetch(`http://127.0.0.1:${PORT}/api/admin/withdrawals/export-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawalIds: [wthId1]
      })
    });
    assert.equal(exportRes2.status, 400, 'Duplicate export must be rejected with HTTP 400');
    const exportData2 = await exportRes2.json();
    assert(exportData2.message.includes('ALREADY_EXPORTED') || exportData2.message.includes('SUBMITTED_TO_BANK'), `Message must explain already submitted: ${exportData2.message}`);

    // -----------------------------------------------------------------
    // TEST 5: Completing payout without UTR is REJECTED
    // -----------------------------------------------------------------
    console.log('6. Completing payout without UTR (must be rejected)...');
    const compNoUtrRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'APPROVE', // or COMPLETE
        utr: ''
      })
    });
    assert.equal(compNoUtrRes.status, 400, 'Completion without UTR must be rejected');
    const compNoUtrData = await compNoUtrRes.json();
    assert(compNoUtrData.message.includes('UTR_REQUIRED'), 'Error must be UTR_REQUIRED');

    // -----------------------------------------------------------------
    // TEST 6: Completing payout with valid UTR succeeds and status becomes COMPLETED
    // -----------------------------------------------------------------
    console.log('7. Completing payout with valid UTR (UTR-HDFC-99001)...');
    const compRes1 = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'APPROVE',
        utr: 'UTR-HDFC-99001'
      })
    });
    const compData1 = await compRes1.json();
    assert.equal(compRes1.status, 200, `Completion must succeed: ${JSON.stringify(compData1)}`);
    assert.equal(compData1.withdrawal.status, 'COMPLETED');
    assert.equal(compData1.withdrawal.utr, 'UTR-HDFC-99001');

    // -----------------------------------------------------------------
    // TEST 7: Duplicate UTR is REJECTED
    // -----------------------------------------------------------------
    console.log('8. Completing second payout with DUPLICATE UTR (must be rejected)...');
    const dupUtrRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawal_id: wthId2,
        action: 'APPROVE',
        utr: 'UTR-HDFC-99001' // Duplicate!
      })
    });
    assert.equal(dupUtrRes.status, 400, 'Duplicate UTR must be rejected with HTTP 400');
    const dupUtrData = await dupUtrRes.json();
    assert(dupUtrData.message.includes('DUPLICATE_UTR'), 'Error must cite DUPLICATE_UTR');

    // Complete wthId2 with unique UTR
    console.log('9. Completing second payout with unique UTR...');
    const compRes2 = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawal_id: wthId2,
        action: 'APPROVE',
        utr: 'UTR-HDFC-99002'
      })
    });
    assert.equal(compRes2.status, 200);

    // -----------------------------------------------------------------
    // TEST 8: Terminal state protection: Completed payout CANNOT be rejected
    // -----------------------------------------------------------------
    console.log('10. Attempting to reject COMPLETED payout (must be refused)...');
    const rejectCompRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawal_id: wthId1,
        action: 'REJECT',
        remark: 'Try reject'
      })
    });
    assert.equal(rejectCompRes.status, 400, 'Rejecting a completed payout must be rejected');

    console.log('✅ ALL WITHDRAWAL LIFECYCLE, EXPORT & UTR TESTS PASSED!');
  } finally {
    server.close();
    await pool.end();
  }
}

testWithdrawalsAndExport().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
