import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { postLedgerEntry, getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 6: Row-Level Locking & 50 Concurrent Withdrawals ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // 1. Setup user, wallet, and approved beneficiary
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('MID6001', 'Concurrency Merchant', '9876543111', 'MERCHANT');
      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('MID6001', 0);
      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-6001', 'MID6001', 'State Bank of India', '1234567890', 'SBIN0001234', 'Concurrency Merchant', true);
    `);

    // Fund merchant with exactly Rs 10,000 (1,000,000 paise)
    await client.query('BEGIN');
    await postLedgerEntry(client, {
      userId: 'MID6001',
      type: 'swipe_credit',
      amountPaise: 1000000n, // Rs 10,000
      referenceId: 'FUND-001',
      channel: 'pinelabs'
    });
    await client.query('COMMIT');
  } finally {
    client.release();
  }

  // 2. Test Invalid Beneficiary Rejection
  const client2 = await testPool.connect();
  try {
    await client2.query('BEGIN');
    await assert.rejects(
      async () => {
        await processWithdrawalRequest(client2, {
          merchantId: 'MID6001',
          amountPaise: 10000n,
          beneficiaryId: 'FAKE-BENEFICIARY-ID',
          channel: 'pinelabs'
        });
      },
      { message: /INVALID_BENEFICIARY/ },
      'Unregistered beneficiary must be rejected'
    );
    await client2.query('ROLLBACK');
  } finally {
    client2.release();
  }

  // 3. 50 Concurrent Withdrawals of Rs 200 (20,000 paise)
  // Total available = Rs 10,000 (1,000,000 paise).
  // Reserve required = Rs 500 (50,000 paise).
  // Max withdrawable = 950,000 paise.
  // 47 withdrawals * 20,000 = 940,000 paise -> remaining balance = 60,000 paise (Rs 600 >= Rs 500 reserve).
  // The 48th would require 20,000 paise, leaving 40,000 < 50,000 reserve, so it and subsequent 2 MUST be rejected!
  console.log('Firing 50 concurrent withdrawal requests of Rs 200 each...');

  const concurrentRequests = Array.from({ length: 50 }, (_, i) => async () => {
    const conn = await testPool.connect();
    try {
      await conn.query('BEGIN');
      const res = await processWithdrawalRequest(conn, {
        merchantId: 'MID6001',
        amountPaise: 20000n, // Rs 200
        beneficiaryId: 'BEN-6001',
        channel: 'pinelabs',
        idempotencyKey: `CONCURRENT-WTH-${i + 1}`
      });
      await conn.query('COMMIT');
      return { success: true, res };
    } catch (err) {
      await conn.query('ROLLBACK');
      return { success: false, error: err.message };
    } finally {
      conn.release();
    }
  });

  const results = await Promise.all(concurrentRequests.map(fn => fn()));
  const successful = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  console.log(`Concurrent results: ${successful.length} succeeded, ${rejected.length} rejected due to reserve protection.`);

  assert.equal(successful.length, 47, 'Exactly 47 withdrawals must succeed');
  assert.equal(rejected.length, 3, 'Exactly 3 withdrawals must be blocked by reserve check');

  // Verify final wallet balance
  const clientCheck = await testPool.connect();
  try {
    const finalBalance = await getWalletBalances(clientCheck, 'MID6001');
    assert.equal(finalBalance.balance_paise, 60000n, 'Remaining balance must be exactly Rs 600 (60,000 paise)');
    assert.ok(finalBalance.balance_paise >= finalBalance.reserve_required_paise, 'Balance must NEVER breach reserve');

    // Verify reconciliation
    const recon = await verifyWalletReconciliation(clientCheck, 'MID6001');
    assert.equal(recon.reconciled, true, 'Wallet cache must exactly match sum of ledger entries');
  } finally {
    clientCheck.release();
    await testPool.end();
  }

  console.log('✅ TEST 6 PASSED: Row-level locking prevented overspend across 50 concurrent requests.');
}

runTest().catch(err => {
  console.error('❌ TEST 6 FAILED:', err);
  process.exit(1);
});
