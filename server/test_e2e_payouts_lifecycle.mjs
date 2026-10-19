import assert from 'node:assert/strict';
import { query, pgQuery } from './pg_db.js';
import { generateToken } from './security.js';

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function main() {
  console.log('=== STARTING END-TO-END PAYOUTS & SWIPES VERIFICATION ===\n');

  const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'RONAV Super Admin' });
  const ddToken = generateToken({ id: 'DD1001', role: 'DISTRICT_DISTRIBUTOR', name: 'D Nikcs' });

  // STEP 1: Verify /api/admin/pending returns clean split totals & unaudited swipes
  console.log('1. Checking /api/admin/pending endpoint output...');
  const pendingRes = await fetch(`${BASE_URL}/api/admin/pending`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.equal(pendingRes.status, 200, '/api/admin/pending must return HTTP 200');
  const pendingData = await pendingRes.json();
  assert.equal(pendingData.success, true, 'Response must succeed');

  console.log('Withdrawal totals from server:', pendingData.stats.withdrawalTotals);
  // Both DD1001 requests are REGULAR, total = Rs 5,000
  assert(pendingData.stats.withdrawalTotals.pending_regular_amount >= 5000, 'pending_regular_amount must include the DD1001 Rs 5000 requests');
  
  // Verify DD1001 requests exist and have payout_type = REGULAR
  const dd1001Items = (pendingData.allWithdrawals || []).filter(w => w.merchant_id === 'DD1001');
  assert(dd1001Items.length >= 2, 'DD1001 withdrawals must exist in allWithdrawals');
  for (const item of dd1001Items) {
    assert.equal(item.payout_type, 'REGULAR', `DD1001 item ${item.id} must have payout_type = REGULAR`);
  }
  console.log('✓ Step 1 Passed: /api/admin/pending correctly reports pending_regular_amount and payout_type = REGULAR.');

  // STEP 2: Verify unaudited swipes appear in pendingTransactions for audit
  console.log('\n2. Checking unaudited swipes in pendingTransactions...');
  const pendingSwipes = pendingData.pendingTransactions || [];
  console.log(`Found ${pendingSwipes.length} unaudited swipe(s) in queue.`);
  assert(pendingSwipes.length > 0, 'Must have at least 1 unaudited swipe in queue');
  const latestSwipe = pendingSwipes[0];
  console.log(`Latest unaudited swipe: ID ${latestSwipe.id}, Amount: ₹${latestSwipe.amount_paise / 100}, Ref: ${latestSwipe.ref_number}`);
  console.log('✓ Step 2 Passed: Unaudited swipes correctly appear in audit queue.');

  // STEP 3: Verify single-step export Excel using an isolated test withdrawal
  console.log('\n3. Testing single-step Export Excel endpoint...');
  const testWthId = `WTH-E2E-${Date.now()}`;
  await pgQuery(`
    INSERT INTO withdrawals (
      id, merchant_id, channel, amount, amount_paise, fee_paise, net_payout_paise,
      settlement_type, payout_type, status, beneficiary_id, created_at
    ) VALUES (
      $1, 'DD1001', 'pinelabs', 100.00, 10000, 0, 10000,
      'T1', 'REGULAR', 'PENDING', 'BEN-127338-686', NOW()
    )
  `, [testWthId]);

  const exportRes = await fetch(`${BASE_URL}/api/admin/withdrawals/export-excel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      withdrawalIds: [testWthId],
      batchTag: 'TEST_E2E_BATCH',
      batchName: 'E2E_Bank_Batch'
    })
  });
  const exportBodyText = await exportRes.text();
  if (exportRes.status !== 200) {
    console.error('Export Excel failed:', exportRes.status, exportBodyText);
  }
  assert.equal(exportRes.status, 200, `Export Excel must succeed with 200: ${exportBodyText}`);
  const exportData = JSON.parse(exportBodyText);
  assert.equal(exportData.success, true, 'Export response must be success');
  assert(exportData.csv && exportData.csv.includes('Beneficiary Name'), 'Must return valid CSV content');
  
  // Verify DB status changed to SUBMITTED_TO_BANK in that single call
  const checkExported = await pgQuery(`SELECT id, status, batch_id, admin_remark FROM withdrawals WHERE id = $1`, [testWthId]);
  assert.equal(checkExported[0].status, 'SUBMITTED_TO_BANK', 'Status must be SUBMITTED_TO_BANK after export');
  assert(checkExported[0].batch_id, 'batch_id must be assigned');
  assert(checkExported[0].admin_remark.includes('BATCH:TEST_E2E_BATCH'), 'admin_remark must contain batch tag');
  console.log('✓ Step 3 Passed: Export Excel executed in ONE single call (CSV generated + SUBMITTED_TO_BANK status).');

  // STEP 4: Test UTR Disbursal
  console.log('\n4. Testing UTR Disbursal on exported item...');
  const utrTest = `UTR_E2E_${Date.now().toString().slice(-8)}`;
  const disburseRes = await fetch(`${BASE_URL}/api/admin/verify-withdrawal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      id: testWthId,
      action: 'COMPLETE',
      utr: utrTest,
      remark: 'Disbursed via E2E test'
    })
  });
  assert.equal(disburseRes.status, 200, 'Disbursal must return 200');
  const disburseData = await disburseRes.json();
  assert.equal(disburseData.success, true, 'Disbursal must succeed');

  const checkCompleted = await pgQuery(`SELECT status, utr FROM withdrawals WHERE id = $1`, [testWthId]);
  assert.equal(checkCompleted[0].status, 'COMPLETED', 'Status must be COMPLETED');
  assert.equal(checkCompleted[0].utr, utrTest, 'UTR must match');
  console.log('✓ Step 4 Passed: UTR disbursal updated status to COMPLETED with verified UTR.');

  // STEP 5: Test Server-Side Commission Lock Enforcement
  console.log('\n5. Testing Server-Side Commission Lock...');
  // Turn lock ON
  await pgQuery(`UPDATE system_settings SET value_numeric = 1 WHERE key = 'commission_payouts_locked'`);

  // Attempt commission withdrawal
  const commReqRes = await fetch(`${BASE_URL}/api/withdrawals/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ddToken}`
    },
    body: JSON.stringify({
      merchant_id: 'DD1001',
      amount_paise: 5000,
      payout_type: 'COMMISSION',
      channel: 'pinelabs',
      account_number: '998877665544',
      ifsc: 'HDFC0001234'
    })
  });
  assert.equal(commReqRes.status, 400, 'Commission withdrawal must be rejected when locked');
  const commReqData = await commReqRes.json();
  assert(commReqData.message.includes('COMMISSION_PAYOUTS_LOCKED'), 'Must return COMMISSION_PAYOUTS_LOCKED');
  console.log('✓ Step 5 Passed: Server strictly blocks commission withdrawals when lock is active.');

  // Turn lock OFF
  await pgQuery(`UPDATE system_settings SET value_numeric = 0 WHERE key = 'commission_payouts_locked'`);
  console.log('✓ Step 5.1 Passed: Unlocked commission payouts.');

  // STEP 6: Clean up the isolated test withdrawal
  console.log('\n6. Cleaning up isolated test withdrawal...');
  await pgQuery(`DELETE FROM withdrawals WHERE id = $1`, [testWthId]);
  console.log('✓ Step 6 Passed: Isolated test record cleaned up.');

  console.log('\n============================================================');
  console.log('🎉 ALL END-TO-END TESTS PASSED WITH 100% SUCCESS!');
  console.log('============================================================');
  const { getDbPool } = await import('./pg_db.js');
  await getDbPool().end();
}

main().catch(async (err) => {
  console.error('E2E Test Failed:', err);
  const { getDbPool } = await import('./pg_db.js');
  await getDbPool().end().catch(() => {});
  process.exit(1);
});
