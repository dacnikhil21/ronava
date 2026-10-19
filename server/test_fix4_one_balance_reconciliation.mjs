import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { getWalletBalances } from './ledger_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { setUserRate } from './rate_engine.js';

async function testOneBalanceReconciliation() {
  console.log('--- TEST: One Balance Single Source of Truth & Reconciliation ---');
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    const mid = `MID-BAL-${Date.now().toString().slice(-4)}`;
    const mob = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Bal Merchant', $2, 'MERCHANT', 'ADM001')`, [mid, mob]);
    await client.query(`INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)`, [mid]);
    await setUserRate(client, { userId: mid, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    // Step 1: Swipe 1
    const swipe1 = await processSwipeTransaction(client, {
      merchantId: mid,
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: mid
    });

    // Verify wallet equals ledger
    const bal1 = await getWalletBalances(client, mid);
    const sum1 = await client.query('SELECT SUM(amount_paise)::bigint as total FROM financial_ledger WHERE user_id = $1', [mid]);
    assert.equal(bal1.balance_paise, BigInt(sum1.rows[0].total), 'Wallet balance must equal ledger sum after swipe');

    // Step 2: Withdrawal
    const wth1 = await processWithdrawalRequest(client, {
      merchantId: mid,
      amountPaise: 400000n, // Rs 4,000
      channel: 'pinelabs',
      bankName: 'SBI',
      accountNumber: '1122334455',
      ifsc: 'SBIN0001234',
      holderName: 'Bal Merchant'
    });

    const bal2 = await getWalletBalances(client, mid);
    const sum2 = await client.query('SELECT SUM(amount_paise)::bigint as total FROM financial_ledger WHERE user_id = $1', [mid]);
    assert.equal(bal2.balance_paise, BigInt(sum2.rows[0].total), 'Wallet balance must equal ledger sum after withdrawal');

    // Step 3: Tamper with wallet cache to simulate drift
    await client.query('UPDATE wallets SET balance_paise = balance_paise + 50000 WHERE user_id = $1', [mid]);

    let driftError = null;
    try {
      await getWalletBalances(client, mid);
    } catch (err) {
      driftError = err;
    }

    assert.ok(driftError, 'System must fail loudly if wallet and ledger disagree');
    assert.ok(
      driftError.message.includes('LEDGER_WALLET_DISCREPANCY'),
      `Error must indicate LEDGER_WALLET_DISCREPANCY. Got: ${driftError.message}`
    );

    let wthDriftError = null;
    try {
      await processWithdrawalRequest(client, {
        merchantId: mid,
        amountPaise: 100000n,
        channel: 'pinelabs',
        bankName: 'SBI',
        accountNumber: '1122334455',
        ifsc: 'SBIN0001234',
        holderName: 'Bal Merchant'
      });
    } catch (err) {
      wthDriftError = err;
    }
    assert.ok(wthDriftError, 'Withdrawal engine must fail loudly if wallet and ledger disagree');
    assert.ok(
      wthDriftError.message.includes('LEDGER_WALLET_DISCREPANCY'),
      `Withdrawal error must indicate LEDGER_WALLET_DISCREPANCY. Got: ${wthDriftError.message}`
    );

    console.log('✓ PASS: Reconciliation check fails loudly when ledger and wallet cache disagree.');

  } finally {
    client.release();
    await pool.end();
  }
}

testOneBalanceReconciliation().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
