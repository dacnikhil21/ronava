import http from 'node:http';
import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { handleApiRequest } from './api.js';
import { getDbPool } from './pg_db.js';
import { setUserRate } from './rate_engine.js';
import { postLedgerEntry, getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

const PORT = 5994;

async function runTest() {
  console.log('--- RUNNING TEST: HTTP Admin Reversals and Withdrawal Approvals ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  let txnId = null;
  let wthApprovedId = null;
  let wthRejectedId = null;

  try {
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('AREA7001', 'Area Dist 7', '9848055447', 'DISTRIBUTOR', 'ADM001'),
        ('MID7001', 'Test Merchant 7', '9876543217', 'MERCHANT', 'AREA7001');

      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES
        ('ADM001', 0, 0), ('AREA7001', 0, 0), ('MID7001', 0, 0);

      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-7001', 'MID7001', 'SBI', '111122223333', 'SBIN0001234', 'Merchant 7', true);
    `);

    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
    await setUserRate(client, { userId: 'AREA7001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
    await setUserRate(client, { userId: 'MID7001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    // 1. Process swipe of Rs 10,000
    const swipe = await processSwipeTransaction(client, {
      merchantId: 'MID7001',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      refNumber: 'REF-REV-01',
      createdBy: 'MID7001'
    });
    txnId = swipe.id;

    // MID7001 balance = 985,000 paise (Rs 9,850).
    // AREA7001 commission = 5,000 paise (Rs 50).
    // ADM001 commission = 10,000 paise (Rs 100).
    // 2. Request two withdrawals for MID7001:
    // W1: Rs 300 (30,000 paise)
    const w1 = await processWithdrawalRequest(client, {
      merchantId: 'MID7001',
      amountPaise: 30000n,
      beneficiaryId: 'BEN-7001',
      channel: 'pinelabs',
      settlementType: 'T1'
    });
    wthApprovedId = w1.id;

    // W2: Rs 200 (20,000 paise)
    const w2 = await processWithdrawalRequest(client, {
      merchantId: 'MID7001',
      amountPaise: 20000n,
      beneficiaryId: 'BEN-7001',
      channel: 'pinelabs',
      settlementType: 'T1'
    });
    wthRejectedId = w2.id;
  } finally {
    client.release();
  }

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`HTTP Test Server listening on http://127.0.0.1:${PORT}`);

  try {
    const { generateToken } = await import('./security.js');
    const admToken = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'RONAV Super Admin' });

    // 1. HTTP ADMIN REVERSAL OF TRANSACTION
    console.log('1. Testing HTTP POST /api/admin/verify-transaction with action REJECT...');
    const revRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admToken}`
      },
      body: JSON.stringify({
        transaction_id: txnId,
        action: 'REJECT',
        remark: 'Fraudulent card reported'
      })
    });
    const revJson = await revRes.json();
    assert.equal(revRes.status, 200, `Expected 200, got ${revRes.status}: ${JSON.stringify(revJson)}`);
    assert.equal(revJson.success, true);

    // Verify reversing ledger entries exist and wallets reconciled
    const verifyClient = await testPool.connect();
    try {
      const revLedger = await verifyClient.query(
        `SELECT type, amount_paise FROM financial_ledger WHERE reference_id = $1 ORDER BY id DESC`,
        [txnId]
      );
      // Original: 3 entries (merchant + area + admin). Reversal: 3 entries (refund + 2 adjustments)
      assert.equal(revLedger.rows.length, 6, 'Must have 3 original + 3 reversing ledger entries');

      for (const uid of ['MID7001', 'AREA7001', 'ADM001']) {
        const rec = await verifyWalletReconciliation(verifyClient, uid);
        assert.equal(rec.reconciled, true, `Wallet ${uid} must be reconciled after reversal`);
      }
    } finally {
      verifyClient.release();
    }

    // 2. HTTP ADMIN WITHDRAWAL APPROVAL
    console.log('2. Testing HTTP POST /api/admin/verify-withdrawal with action APPROVE...');
    const appRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admToken}`
      },
      body: JSON.stringify({
        withdrawal_id: wthApprovedId,
        action: 'APPROVE',
        utr: 'UTR-DISBURSED-777'
      })
    });
    const appJson = await appRes.json();
    assert.equal(appRes.status, 200, `Expected 200, got ${appRes.status}: ${JSON.stringify(appJson)}`);
    assert.equal(appJson.success, true);
    assert.ok(appJson.withdrawal.status === 'COMPLETED' || appJson.withdrawal.status === 'APPROVED', `Status should be COMPLETED or APPROVED, got ${appJson.withdrawal.status}`);

    // 3. HTTP ADMIN WITHDRAWAL REJECTION (HOLD RESTORED)
    console.log('3. Testing HTTP POST /api/admin/verify-withdrawal with action REJECT...');
    const rejRes = await fetch(`http://127.0.0.1:${PORT}/api/admin/verify-withdrawal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${admToken}`
      },
      body: JSON.stringify({
        withdrawal_id: wthRejectedId,
        action: 'REJECT',
        remark: 'Bank IFSC invalid'
      })
    });
    const rejJson = await rejRes.json();
    assert.equal(rejRes.status, 200, `Expected 200, got ${rejRes.status}: ${JSON.stringify(rejJson)}`);
    assert.equal(rejJson.success, true);
    assert.equal(rejJson.withdrawal.status, 'REJECTED');

    // Verify rejection reversed hold in financial_ledger
    const verifyClient2 = await testPool.connect();
    try {
      const wthReversalRow = await verifyClient2.query(
        `SELECT type, amount_paise FROM financial_ledger WHERE reference_id = $1 AND type = 'withdrawal_reversal'`,
        [wthRejectedId]
      );
      assert.equal(wthReversalRow.rows.length, 1);
      assert.equal(wthReversalRow.rows[0].amount_paise, '20000', '20,000 paise restored to wallet');

      const rec = await verifyWalletReconciliation(verifyClient2, 'MID7001');
      assert.equal(rec.reconciled, true);
    } finally {
      verifyClient2.release();
    }

    console.log('✅ TEST PASSED: Admin reversals and withdrawal approvals route 100% through Phase B ledger.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      const pool = getDbPool();
      await pool.end();
    } catch (_) {}
    try {
      await testPool.end();
    } catch (_) {}
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
