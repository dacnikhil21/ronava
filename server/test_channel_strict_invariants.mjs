// server/test_channel_strict_invariants.mjs
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import assert from 'node:assert/strict';
import pg from 'pg';
import { getDbPool, pgQuery, withTransaction } from './pg_db.js';
import { postLedgerEntry } from './ledger_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';
import { calculateUserChannelBalances } from './api.js';
import { cleanAndReseed } from './clean_and_reseed.mjs';

async function runTest() {
  console.log('=== TEST: CHANNEL STRICT INVARIANTS & ISOLATION ===');

  // 1. Write validation in postLedgerEntry: missing or invalid channel MUST fail loudly
  console.log('\n1. Testing write rejection for missing/invalid channel in postLedgerEntry...');
  await withTransaction(async (client) => {
    // 1a. Missing channel for swipe_credit
    let errSwipe = null;
    try {
      await postLedgerEntry(client, {
        userId: 'MID1001',
        type: 'swipe_credit',
        amountPaise: 100000n,
        channel: null,
        createdBy: 'MID1001'
      });
    } catch (e) {
      errSwipe = e;
    }
    assert.ok(errSwipe, 'postLedgerEntry must throw error when channel is missing for swipe_credit');
    assert.match(errSwipe.message, /CHANNEL_REQUIRED/i);
    console.log(`   ✓ Missing channel for swipe_credit threw: "${errSwipe.message}"`);

    // 1b. Missing channel for commission
    let errComm = null;
    try {
      await postLedgerEntry(client, {
        userId: 'DIST1001',
        type: 'commission',
        amountPaise: 1000n,
        channel: null,
        createdBy: 'DIST1001'
      });
    } catch (e) {
      errComm = e;
    }
    assert.ok(errComm, 'postLedgerEntry must throw error when channel is missing for commission');
    assert.match(errComm.message, /CHANNEL_REQUIRED/i);
    console.log(`   ✓ Missing channel for commission threw: "${errComm.message}"`);

    // 1c. Invalid channel for withdrawal_hold
    let errInvalid = null;
    try {
      await postLedgerEntry(client, {
        userId: 'MID1001',
        type: 'withdrawal_hold',
        amountPaise: -50000n,
        channel: 'unknown_channel',
        createdBy: 'MID1001'
      });
    } catch (e) {
      errInvalid = e;
    }
    assert.ok(errInvalid, 'postLedgerEntry must throw error when channel is invalid');
    assert.match(errInvalid.message, /INVALID_CHANNEL/i);
    console.log(`   ✓ Invalid channel threw: "${errInvalid.message}"`);
  });

  // 2. Database Level Check Constraint: direct SQL insert without channel for swipe_credit must fail
  console.log('\n2. Testing database-level constraint chk_financial_ledger_channel on ronav_test_db...');
  let sqlErr = null;
  try {
    await pgQuery(`
      INSERT INTO financial_ledger (user_id, type, amount_paise, channel, created_by)
      VALUES ('MID1001', 'swipe_credit', 1000, NULL, 'MID1001')
    `);
  } catch (e) {
    sqlErr = e;
  }
  assert.ok(sqlErr, 'Database must have a check constraint rejecting NULL channel on swipe_credit');
  assert.match(sqlErr.message, /chk_financial_ledger_channel/i);
  console.log(`   ✓ Database rejected NULL channel directly: "${sqlErr.message}"`);

  // 3. New swipe on each channel: Pine Labs, Payswiff, QR (executed on ronav_scenario_db to protect hand-made data)
  console.log('\n3. Testing new swipe on each channel (Pine Labs, Payswiff, QR) on ronav_scenario_db...');
  const SCENARIO_DB_URL = 'postgres://postgres:postgres@localhost:5432/ronav_scenario_db';
  await cleanAndReseed(SCENARIO_DB_URL);

  const scenarioPool = new pg.Pool({ connectionString: SCENARIO_DB_URL });
  const scenarioClient = await scenarioPool.connect();
  try {
    // 3a. Pine Labs swipe (Rs 10,000)
    const pineSwipe = await processSwipeTransaction(scenarioClient, {
      merchantId: 'MID4001',
      amountPaise: 1000000n,
      channel: 'pinelabs',
      settlementMode: 'T1',
      notes: 'Pine Labs Test Swipe',
      refNumber: 'PINE-' + Date.now(),
      createdBy: 'MID4001'
    });

    // 3b. Payswiff swipe (Rs 10,000)
    const payswiffSwipe = await processSwipeTransaction(scenarioClient, {
      merchantId: 'MID4001',
      amountPaise: 1000000n,
      channel: 'payswiff',
      settlementMode: 'T1',
      notes: 'Payswiff Test Swipe',
      refNumber: 'SWIFF-' + Date.now(),
      createdBy: 'MID4001'
    });

    // 3c. QR swipe (Rs 10,000)
    const qrSwipe = await processSwipeTransaction(scenarioClient, {
      merchantId: 'MID4001',
      amountPaise: 1000000n,
      channel: 'qr',
      settlementMode: 'NONE',
      notes: 'QR Test Swipe',
      refNumber: 'QR-' + Date.now(),
      createdBy: 'MID4001'
    });

    // Verify ledger rows have exact channel tags
    const pineRows = (await scenarioClient.query('SELECT channel FROM financial_ledger WHERE reference_id = $1', [pineSwipe.id])).rows;
    const swiffRows = (await scenarioClient.query('SELECT channel FROM financial_ledger WHERE reference_id = $1', [payswiffSwipe.id])).rows;
    const qrRows = (await scenarioClient.query('SELECT channel FROM financial_ledger WHERE reference_id = $1', [qrSwipe.id])).rows;

    assert.ok(pineRows.length > 0 && pineRows.every(r => r.channel === 'pinelabs'), 'Pine Labs ledger rows must be tagged pinelabs');
    assert.ok(swiffRows.length > 0 && swiffRows.every(r => r.channel === 'payswiff'), 'Payswiff ledger rows must be tagged payswiff');
    assert.ok(qrRows.length > 0 && qrRows.every(r => r.channel === 'qr'), 'QR ledger rows must be tagged qr');
    console.log('   ✓ Ledger rows correctly created and tagged for pinelabs, payswiff, and qr.');

    // 4. Verify each channel balance shows ONLY in its own tab
    const chBals = await calculateUserChannelBalances('MID4001', scenarioClient);
    console.log('   MID4001 Channel Balances:', {
      pinelabs: chBals.pinelabs.balance,
      payswiff: chBals.payswiff.balance,
      qr: chBals.qr.balance
    });

    // Pine Labs: 10,000 - 1.5% (150) = 9,850
    assert.equal(chBals.pinelabs.balance, 9850, `Pine Labs tab must show exactly 9850, got ${chBals.pinelabs.balance}`);
    // Payswiff: 10,000 - 1.8% (180) = 9,820
    assert.equal(chBals.payswiff.balance, 9820, `Payswiff tab must show exactly 9820, got ${chBals.payswiff.balance}`);
    // QR: 10,000 - 1.5% (150) = 9,850
    assert.equal(chBals.qr.balance, 9850, `QR tab must show exactly 9850, got ${chBals.qr.balance}`);

    // Verify channel tabs each display only their own balance and do not bleed into each other
    assert.equal(chBals.payswiff.balance, 9820);
    console.log('   ✓ Each balance strictly isolated to its own channel tab.');
  } finally {
    scenarioClient.release();
    await scenarioPool.end();
  }

  console.log('\n=== ✅ ALL CHANNEL INVARIANT TESTS PASSED ===');
}

runTest()
  .then(() => {
    console.log('Test completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  });
