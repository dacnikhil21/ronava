import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { reverseTransaction } from './reversal_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';
import { setUserRate } from './rate_engine.js';

async function testReversalLifecycleAllAges() {
  console.log('--- TEST: Reversal Lifecycle Without 5-Minute Window ---');
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // ----------------------------------------------------
    // CASE 1: Withdrawal requested 10 MINUTES after swipe (Pending)
    // Wallet cannot cover reversal because funds are held in pending withdrawal.
    // MUST refuse with plain message listing pending withdrawals so Admin rejects them first.
    // ----------------------------------------------------
    const mid1 = `MID-REV10M-${Date.now().toString().slice(-4)}`;
    const mob1 = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Merchant 10M', $2, 'MERCHANT', 'ADM001')`, [mid1, mob1]);
    await client.query(`INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)`, [mid1]);
    await setUserRate(client, { userId: mid1, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    const swipe1 = await processSwipeTransaction(client, {
      merchantId: mid1,
      amountPaise: 500000n, // Rs 5,000 (net Rs 4,925)
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: mid1
    });

    const wth1 = await processWithdrawalRequest(client, {
      merchantId: mid1,
      amountPaise: 400000n, // Rs 4,000
      channel: 'pinelabs',
      bankName: 'HDFC Bank',
      accountNumber: '111122223333',
      ifsc: 'HDFC0001234',
      holderName: 'Merchant 10M'
    });

    // Artificially simulate that withdrawal was created 10 minutes AFTER the swipe
    await client.query(`UPDATE withdrawals SET created_at = NOW() + INTERVAL '10 minutes' WHERE id = $1`, [wth1.id]);

    let blockedErr1 = null;
    try {
      await reverseTransaction(client, {
        txnId: swipe1.id,
        reason: 'Customer reported unauthorized card use',
        callerId: 'ADM001'
      });
    } catch (err) {
      blockedErr1 = err;
    }

    assert.ok(blockedErr1, 'Reversal must be refused when pending withdrawals lock necessary funds');
    assert.ok(
      blockedErr1.message.includes(wth1.id),
      `Refusal message must list the pending withdrawal id (${wth1.id}). Got: ${blockedErr1.message}`
    );
    assert.ok(
      blockedErr1.message.toLowerCase().includes('reject'),
      `Refusal message must advise admin to reject them first. Got: ${blockedErr1.message}`
    );
    console.log('✓ PASS: Case 1 - Withdrawal 10 minutes after swipe blocks reversal and lists pending withdrawal ID.');

    // ----------------------------------------------------
    // CASE 2: Withdrawal requested 1 HOUR after swipe (Submitted to Bank)
    // ----------------------------------------------------
    const mid2 = `MID-REV1H-${Date.now().toString().slice(-4)}`;
    const mob2 = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Merchant 1H', $2, 'MERCHANT', 'ADM001')`, [mid2, mob2]);
    await client.query(`INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)`, [mid2]);
    await setUserRate(client, { userId: mid2, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    const swipe2 = await processSwipeTransaction(client, {
      merchantId: mid2,
      amountPaise: 1000000n, // Rs 10,000 (net Rs 9,850)
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: mid2
    });

    const wth2 = await processWithdrawalRequest(client, {
      merchantId: mid2,
      amountPaise: 900000n,
      channel: 'pinelabs',
      bankName: 'SBI',
      accountNumber: '444455556666',
      ifsc: 'SBIN0001234',
      holderName: 'Merchant 1H'
    });

    // Simulate created 1 hour after swipe and marked SUBMITTED_TO_BANK
    await client.query(`UPDATE withdrawals SET status = 'SUBMITTED_TO_BANK', created_at = NOW() + INTERVAL '1 hour' WHERE id = $1`, [wth2.id]);

    let blockedErr2 = null;
    try {
      await reverseTransaction(client, {
        txnId: swipe2.id,
        reason: 'Bank chargeback alert',
        callerId: 'ADM001',
        recordShortfallAsOwed: false
      });
    } catch (err) {
      blockedErr2 = err;
    }
    assert.ok(blockedErr2, 'Must not go negative silently if recordShortfallAsOwed is false');

    // Now Admin confirms recording shortfall as OWED
    const rev2 = await reverseTransaction(client, {
      txnId: swipe2.id,
      reason: 'Bank chargeback alert confirmed',
      callerId: 'ADM001',
      recordShortfallAsOwed: true
    });
    assert.equal(rev2.status, 'REVERSED');

    const balCheck2 = await client.query('SELECT balance_paise FROM wallets WHERE user_id = $1', [mid2]);
    assert.ok(BigInt(balCheck2.rows[0].balance_paise) < 0n, 'Balance must be recorded as negative (owed)');
    console.log('✓ PASS: Case 2 - Withdrawal 1 hour after swipe in SUBMITTED_TO_BANK records shortfall as OWED upon confirmation.');

    // ----------------------------------------------------
    // CASE 3: Withdrawal requested 2 DAYS after swipe (Completed / Paid)
    // ----------------------------------------------------
    const mid3 = `MID-REV2D-${Date.now().toString().slice(-4)}`;
    const mob3 = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Merchant 2D', $2, 'MERCHANT', 'ADM001')`, [mid3, mob3]);
    await client.query(`INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)`, [mid3]);
    await setUserRate(client, { userId: mid3, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    const swipe3 = await processSwipeTransaction(client, {
      merchantId: mid3,
      amountPaise: 800000n, // Rs 8,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: mid3
    });

    const wth3 = await processWithdrawalRequest(client, {
      merchantId: mid3,
      amountPaise: 700000n,
      channel: 'pinelabs',
      bankName: 'Axis Bank',
      accountNumber: '777788889999',
      ifsc: 'UTIB0001234',
      holderName: 'Merchant 2D'
    });

    const dynamicUtr = `UTR-PAID-2D-${Date.now()}`;
    await client.query(`
      UPDATE withdrawals 
      SET status = 'COMPLETED', utr = $2, created_at = NOW() + INTERVAL '2 days' 
      WHERE id = $1
    `, [wth3.id, dynamicUtr]);
    await client.query(`UPDATE wallets SET held_paise = GREATEST(0, held_paise - 700000) WHERE user_id = $1`, [mid3]);

    const rev3 = await reverseTransaction(client, {
      txnId: swipe3.id,
      reason: 'Confirmed chargeback 2 days later',
      callerId: 'ADM001',
      recordShortfallAsOwed: true
    });
    assert.equal(rev3.status, 'REVERSED');

    const balCheck3 = await client.query('SELECT balance_paise FROM wallets WHERE user_id = $1', [mid3]);
    assert.ok(BigInt(balCheck3.rows[0].balance_paise) < 0n, 'Balance must be negative (owed) for 2-day-old completed withdrawal');
    console.log('✓ PASS: Case 3 - Withdrawal 2 days after swipe in COMPLETED state reverses and records shortfall as OWED.');

  } finally {
    client.release();
    await pool.end();
  }
}

testReversalLifecycleAllAges().then(() => {
  console.log('✓ All reversal age scenarios verified.');
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
