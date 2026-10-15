import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { postLedgerEntry, getWalletBalances } from './ledger_engine.js';
import { quoteWithdrawal } from './withdrawal_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 5: Server Authoritative Wallet Balance & Withdrawal Quote ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    await client.query(`
      INSERT INTO users (id, name, mobile, role) VALUES
        ('MID5001', 'Test Merchant 5', '9876543299', 'MERCHANT');
      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('MID5001', 0);
    `);

    // Credit merchant with Rs 1,000 (100,000 paise)
    await client.query('BEGIN');
    await postLedgerEntry(client, {
      userId: 'MID5001',
      type: 'swipe_credit',
      amountPaise: 100000n,
      referenceId: 'TEST-TXN',
      channel: 'pinelabs'
    });
    await client.query('COMMIT');

    // 1. Check GET wallet balance
    const balance = await getWalletBalances(client, 'MID5001');
    assert.equal(balance.balance_paise, 100000n, 'Balance should be Rs 1,000 (100,000 paise)');
    assert.equal(balance.reserve_required_paise, 50000n, 'Reserve required should be Rs 500 (50,000 paise)');
    assert.equal(balance.reserve_locked_paise, 50000n, 'Reserve locked should be 50,000 paise');
    assert.equal(balance.withdrawable_balance_paise, 50000n, 'Withdrawable balance should be Rs 500 (50,000 paise)');

    // 2. Test POST /api/withdrawals/quote for compliant amount (Rs 400 = 40,000 paise)
    // Instant fee is 1.50% (150 bps) -> 40,000 * 150 / 10000 = 600 paise (Rs 6.00)
    // Net payout = 40,000 - 600 = 39,400 paise (Rs 394.00)
    const quoteCompliant = await quoteWithdrawal(client, {
      userId: 'MID5001',
      amountPaise: 40000n,
      settlementType: 'INSTANT',
      channel: 'pinelabs'
    });
    assert.equal(quoteCompliant.requested_amount_paise, 40000n);
    assert.equal(quoteCompliant.fee_paise, 600n, 'Fee should be 600 paise (Rs 6)');
    assert.equal(quoteCompliant.net_payout_paise, 39400n, 'Net should be 39,400 paise (Rs 394)');
    assert.equal(quoteCompliant.reserve_compliant, true, 'Should be reserve compliant');
    assert.equal(quoteCompliant.remaining_balance_paise, 60000n, 'Remaining balance should be 60,000 paise (Rs 600)');

    // 3. Test POST /api/withdrawals/quote for non-compliant amount that dips below Rs 500 reserve
    // Requesting Rs 600 (60,000 paise) when balance is Rs 1,000 leaves Rs 400 < Rs 500 reserve!
    const quoteNonCompliant = await quoteWithdrawal(client, {
      userId: 'MID5001',
      amountPaise: 60000n,
      settlementType: 'INSTANT',
      channel: 'pinelabs'
    });
    assert.equal(quoteNonCompliant.reserve_compliant, false, 'Must flag reserve violation');
    assert.equal(quoteNonCompliant.shortfall_paise, 10000n, 'Shortfall should be 10,000 paise (Rs 100)');

    console.log('✅ TEST 5 PASSED: Server authoritative wallet balance and withdrawal quote working.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST 5 FAILED:', err);
  process.exit(1);
});
