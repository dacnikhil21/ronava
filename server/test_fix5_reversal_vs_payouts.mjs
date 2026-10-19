import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { reverseTransaction } from './reversal_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { processWithdrawalRequest } from './withdrawal_engine.js';
import { setUserRate } from './rate_engine.js';

async function testReversalVsPayouts() {
  console.log('--- TEST: Swipe Reversal vs Payouts Lifecycle ---');
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // ----------------------------------------------------
    // CASE A: PENDING payout auto-rejected on swipe reversal
    // ----------------------------------------------------
    const uniqueSuffixA = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
    const testMidA = `MID-REVA-${uniqueSuffixA}`;
    const testMobA = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Test Rev Merchant A', $2, 'MERCHANT', 'ADM001')
    `, [testMidA, testMobA]);
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)
    `, [testMidA]);
    await setUserRate(client, { userId: testMidA, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    const swipeA = await processSwipeTransaction(client, {
      merchantId: testMidA,
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: testMidA
    });

    const payoutA = await processWithdrawalRequest(client, {
      merchantId: testMidA,
      amountPaise: 400000n,
      channel: 'pinelabs',
      bankName: 'SBI',
      accountNumber: '123456789012',
      ifsc: 'SBIN0001234',
      holderName: 'Test Rev Merchant A'
    });
    assert.equal(payoutA.status, 'PENDING');

    // Rule FIX 1: Must refuse reversal when funds are locked in PENDING withdrawal, listing the withdrawal ID
    let blockedErrA = null;
    try {
      await reverseTransaction(client, {
        txnId: swipeA.id,
        reason: 'Fraudulent card reported',
        callerId: 'ADM001'
      });
    } catch (err) {
      blockedErrA = err;
    }
    assert.ok(blockedErrA, 'Reversal must be refused if pending withdrawals hold needed funds');
    assert.ok(blockedErrA.message.includes(payoutA.id), 'Refusal message must list the pending withdrawal id');

    // Admin rejects the pending withdrawal first
    await client.query(`UPDATE withdrawals SET status = 'REJECTED' WHERE id = $1`, [payoutA.id]);
    await client.query(`UPDATE wallets SET held_paise = GREATEST(0, held_paise - 400000) WHERE user_id = $1`, [testMidA]);
    // Post ledger refund hold
    const { postLedgerEntry } = await import('./ledger_engine.js');
    await postLedgerEntry(client, {
      userId: testMidA,
      type: 'withdrawal_reversal',
      amountPaise: 400000n,
      referenceId: payoutA.id,
      referenceType: 'WITHDRAWAL',
      channel: 'pinelabs',
      createdBy: 'ADM001'
    });

    // Now reversal succeeds cleanly!
    const revResultA = await reverseTransaction(client, {
      txnId: swipeA.id,
      reason: 'Fraudulent card reported',
      callerId: 'ADM001'
    });
    assert.equal(revResultA.status, 'REVERSED');
    console.log('✓ TEST PASSED: Case A - PENDING payout refused reversal until rejected by Admin.');

    // ----------------------------------------------------
    // CASE B: SUBMITTED_TO_BANK payout blocks reversal without confirmFraud, raises alert
    // ----------------------------------------------------
    const uniqueSuffixB = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
    const testMidB = `MID-REVB-${uniqueSuffixB}`;
    const testMobB = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Test Rev Merchant B', $2, 'MERCHANT', 'ADM001')
    `, [testMidB, testMobB]);
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)
    `, [testMidB]);
    await setUserRate(client, { userId: testMidB, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    const swipeB = await processSwipeTransaction(client, {
      merchantId: testMidB,
      amountPaise: 1000000n,
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: testMidB
    });

    const payoutB = await processWithdrawalRequest(client, {
      merchantId: testMidB,
      amountPaise: 600000n,
      channel: 'pinelabs',
      bankName: 'HDFC',
      accountNumber: '987654321098',
      ifsc: 'HDFC0001234',
      holderName: 'Test Rev Merchant B'
    });

    // Mark payout as SUBMITTED_TO_BANK
    await client.query(`UPDATE withdrawals SET status = 'SUBMITTED_TO_BANK' WHERE id = $1`, [payoutB.id]);

    // Reversal without confirmFraud MUST throw and raise alert
    let blockedErrorB = null;
    try {
      await reverseTransaction(client, {
        txnId: swipeB.id,
        reason: 'Suspected chargeback',
        callerId: 'ADM001',
        confirmFraud: false
      });
    } catch (err) {
      blockedErrorB = err;
    }
    assert.ok(blockedErrorB, 'Must block reversal if payout is SUBMITTED_TO_BANK and confirmFraud is false');
    assert.equal(blockedErrorB.code, 'REVERSAL_REQUIRES_FRAUD_CONFIRMATION');

    // Verify alert remark was added to payout
    const alertCheckB = await client.query('SELECT admin_remark FROM withdrawals WHERE id = $1', [payoutB.id]);
    assert.ok(alertCheckB.rows[0].admin_remark.includes('FRAUD_ALERT'), 'Payout must have FRAUD_ALERT remark');

    // Reversal WITH confirmFraud: true MUST succeed
    const revResultB = await reverseTransaction(client, {
      txnId: swipeB.id,
      reason: 'Confirmed chargeback after review',
      callerId: 'ADM001',
      confirmFraud: true
    });
    assert.equal(revResultB.status, 'REVERSED');
    console.log('✓ TEST PASSED: Case B - SUBMITTED_TO_BANK payout blocks reversal until Admin confirms fraud.');

    // ----------------------------------------------------
    // CASE C: COMPLETED payout blocks reversal without confirmFraud; after confirm balance goes negative
    // ----------------------------------------------------
    const uniqueSuffixC = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
    const testMidC = `MID-REVC-${uniqueSuffixC}`;
    const testMobC = `98${Math.floor(10000000 + Math.random() * 89999999)}`;
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES ($1, 'Test Rev Merchant C', $2, 'MERCHANT', 'ADM001')
    `, [testMidC, testMobC]);
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES ($1, 0, 0)
    `, [testMidC]);
    await setUserRate(client, { userId: testMidC, channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });

    const swipeC = await processSwipeTransaction(client, {
      merchantId: testMidC,
      amountPaise: 1000000n, // Rs 10,000 credit (net ~9850)
      channel: 'pinelabs',
      settlementMode: 'T1',
      createdBy: testMidC
    });

    const payoutC = await processWithdrawalRequest(client, {
      merchantId: testMidC,
      amountPaise: 900000n, // Rs 9,000
      channel: 'pinelabs',
      bankName: 'ICICI',
      accountNumber: '112233445566',
      ifsc: 'ICIC0001234',
      holderName: 'Test Rev Merchant C'
    });

    // Complete the payout (disburse)
    const uniqueUtr = `UTR-COMP-${Date.now().toString().slice(-6)}-${Math.floor(100+Math.random()*899)}`;
    await client.query(`
      UPDATE withdrawals SET status = 'COMPLETED', utr = $1 WHERE id = $2
    `, [uniqueUtr, payoutC.id]);
    await client.query(`
      UPDATE wallets SET held_paise = GREATEST(0, held_paise - 900000) WHERE user_id = $1
    `, [testMidC]);

    // Reversal without confirmFraud MUST throw and raise alert
    let blockedErrorC = null;
    try {
      await reverseTransaction(client, {
        txnId: swipeC.id,
        reason: 'Confirmed stolen card',
        callerId: 'ADM001',
        confirmFraud: false
      });
    } catch (err) {
      blockedErrorC = err;
    }
    assert.ok(blockedErrorC, 'Must block reversal if payout is COMPLETED and confirmFraud is false');
    assert.equal(blockedErrorC.code, 'REVERSAL_REQUIRES_FRAUD_CONFIRMATION');

    // Now Admin confirms fraud -> reversal executes and balance goes negative
    const revResultC = await reverseTransaction(client, {
      txnId: swipeC.id,
      reason: 'Confirmed stolen card by Admin review',
      callerId: 'ADM001',
      confirmFraud: true
    });
    assert.equal(revResultC.status, 'REVERSED');

    const walletCheckC = await client.query('SELECT balance_paise FROM wallets WHERE user_id = $1', [testMidC]);
    const finalBalancePaise = BigInt(walletCheckC.rows[0].balance_paise);
    assert.ok(finalBalancePaise < 0n, `Balance must be negative after reversing swipe when payout already COMPLETED. Got: ${finalBalancePaise}`);
    console.log(`✓ TEST PASSED: Case C - COMPLETED payout reversed on fraud confirmation, balance negative (${finalBalancePaise} paise).`);


  } finally {
    client.release();
    await pool.end();
  }
}

testReversalVsPayouts().then(() => {
  console.log('✓ All 3 reversal vs payout cases passed successfully.');
  process.exit(0);
}).catch(err => {
  console.error('TEST FAILED:', err.message);
  process.exit(1);
});
