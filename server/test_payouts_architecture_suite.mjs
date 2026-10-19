import assert from 'node:assert/strict';
import { query, pgQuery } from './pg_db.js';
import { getWalletBalances, postLedgerEntry } from './ledger_engine.js';
import { quoteWithdrawal, processWithdrawalRequest } from './withdrawal_engine.js';

async function runTests() {
  console.log('=== RUNNING PAYOUTS ARCHITECTURE TEST SUITE ===');

  // TEST 1: DD1001's two existing requests must have payout_type = 'REGULAR' and status = 'PENDING'
  console.log('\n--- TEST 1: Existing DD1001 Requests Schema Integrity ---');
  const dd1001Rows = await pgQuery(`
    SELECT id, merchant_id, amount_paise, channel, payout_type, status 
    FROM withdrawals 
    WHERE merchant_id = 'DD1001' AND amount_paise = 250000
    ORDER BY created_at ASC
  `);
  assert.equal(dd1001Rows.length, 2, 'Must have exactly 2 requests for DD1001 of Rs 2,500');
  assert.equal(dd1001Rows[0].payout_type, 'REGULAR', 'DD1001 first request must be REGULAR');
  assert.equal(dd1001Rows[1].payout_type, 'REGULAR', 'DD1001 second request must be REGULAR');
  assert.equal(dd1001Rows[0].status, 'PENDING', 'DD1001 first request must be PENDING');
  assert.equal(dd1001Rows[1].status, 'PENDING', 'DD1001 second request must be PENDING');
  console.log('✓ TEST 1 PASSED: DD1001 requests have explicit payout_type = REGULAR and status = PENDING.');

  // TEST 2: Process a new withdrawal request with explicit payout_type
  console.log('\n--- TEST 2: Process Withdrawal with payout_type ---');
  // First, verify quote
  const quote = await quoteWithdrawal(getDbPool(), {
    userId: 'MID1001',
    amountPaise: 10000n, // Rs 100
    settlementType: 'T1',
    channel: 'pinelabs'
  });
  assert(quote.max_withdrawable_paise >= 10000n, 'MID1001 must have withdrawable balance');

  let newWthId = null;
  await withTransaction(async (client) => {
    const res = await processWithdrawalRequest(client, {
      merchantId: 'MID1001',
      amountPaise: 10000n,
      payoutType: 'REGULAR',
      channel: 'pinelabs',
      settlementType: 'T1',
      accountNumber: '12345678901',
      ifsc: 'SBIN0001234',
      bankName: 'State Bank of India',
      holderName: 'D Nik'
    });
    newWthId = res.id;
    assert.equal(res.payout_type, 'REGULAR', 'Result payout_type must be REGULAR');
    assert.equal(res.status, 'PENDING', 'Result status must be PENDING');
  });

  const checkDb = await pgQuery(`SELECT * FROM withdrawals WHERE id = $1`, [newWthId]);
  assert.equal(checkDb.length, 1, 'Withdrawal must exist in database');
  assert.equal(checkDb[0].payout_type, 'REGULAR', 'DB payout_type must be REGULAR');
  assert.equal(checkDb[0].status, 'PENDING', 'DB status must be PENDING');
  console.log('✓ TEST 2 PASSED: New withdrawal created with payout_type = REGULAR.');

  // TEST 3: Atomicity & Rollback Mid-Transition
  console.log('\n--- TEST 3: Atomicity - Mid-Transition Failure Must Rollback Everything ---');
  const balBefore = await getWalletBalances(getDbPool(), 'MID1001');
  const countBefore = (await pgQuery(`SELECT COUNT(*)::int as c FROM withdrawals`))[0].c;
  const ledgerCountBefore = (await pgQuery(`SELECT COUNT(*)::int as c FROM financial_ledger`))[0].c;

  try {
    await withTransaction(async (client) => {
      await processWithdrawalRequest(client, {
        merchantId: 'MID1001',
        amountPaise: 5000n,
        payoutType: 'REGULAR',
        channel: 'pinelabs',
        settlementType: 'T1',
        accountNumber: '12345678901',
        ifsc: 'SBIN0001234',
        bankName: 'State Bank of India',
        holderName: 'D Nik'
      });
      // Force synthetic failure midway through transaction
      throw new Error('SYNTHETIC_SIMULATED_FAILURE: Testing 100% rollback');
    });
    assert.fail('Should have thrown synthetic error');
  } catch (err) {
    assert(err.message.includes('SYNTHETIC_SIMULATED_FAILURE'), 'Caught synthetic failure');
  }

  const balAfter = await getWalletBalances(getDbPool(), 'MID1001');
  const countAfter = (await pgQuery(`SELECT COUNT(*)::int as c FROM withdrawals`))[0].c;
  const ledgerCountAfter = (await pgQuery(`SELECT COUNT(*)::int as c FROM financial_ledger`))[0].c;

  assert.equal(countAfter, countBefore, 'Withdrawals row count must NOT change on aborted transaction');
  assert.equal(ledgerCountAfter, ledgerCountBefore, 'Ledger row count must NOT change on aborted transaction');
  assert.equal(balAfter.held_paise, balBefore.held_paise, 'Held balance must NOT change on aborted transaction');
  console.log('✓ TEST 3 PASSED: 100% atomic rollback proven. No half-written rows or held balances.');

  // TEST 4: Clean up test withdrawal
  await withTransaction(async (client) => {
    // Reject test withdrawal to restore wallet funds cleanly
    await postLedgerEntry(client, {
      userId: 'MID1001',
      type: 'withdrawal_reversal',
      amountPaise: 10000n,
      referenceId: newWthId,
      referenceType: 'WITHDRAWAL',
      channel: 'pinelabs',
      metadata: { reason: 'Automated test suite cleanup' },
      createdBy: 'ADM001'
    });
    await client.query(`UPDATE withdrawals SET status = 'REJECTED', admin_remark = 'Test cleanup' WHERE id = $1`, [newWthId]);
  });
  console.log('✓ TEST 4 PASSED: Cleanly rejected temporary test withdrawal.');

  console.log('\n=== ALL ARCHITECTURAL TESTS PASSED ===');
  process.exit(0);
}

// Helper withTransaction
import { getDbPool } from './pg_db.js';
async function withTransaction(fn) {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
