import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST: Duplicate Manual Swipe Entry Rejection ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('MID9001', 'Manual Swipe Merchant', '9876543999', 'MERCHANT', 'ADM001');

      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('ADM001', 0), ('MID9001', 0);
    `);

    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', rateBps: 60 });
    await setUserRate(client, { userId: 'MID9001', channel: 'pinelabs', rateBps: 150 });

    // 1. Post a manual swipe with merchant + slip/UTR + amount + date
    console.log('1. Posting first manual swipe entry...');
    const firstSwipe = await processSwipeTransaction(client, {
      merchantId: 'MID9001',
      amountPaise: 500000n, // Rs 5,000
      channel: 'pinelabs',
      refNumber: 'UTR-9876543210',
      slipNumber: 'SLIP-4411',
      idempotencyKey: 'IDEMP-MANUAL-1'
    });
    assert.ok(firstSwipe.id);

    // 2. Post duplicate manual swipe with SAME merchant + UTR/slip + amount on the same day
    console.log('2. Attempting duplicate manual swipe (same merchant + UTR + amount + date)...');
    await assert.rejects(
      async () => {
        await processSwipeTransaction(client, {
          merchantId: 'MID9001',
          amountPaise: 500000n, // SAME amount
          channel: 'pinelabs',
          refNumber: 'UTR-9876543210', // SAME UTR
          slipNumber: 'SLIP-4411',
          idempotencyKey: 'IDEMP-MANUAL-2' // Different idempotency key
        });
      },
      (err) => {
        assert.match(err.message, /DUPLICATE_SWIPE/);
        assert.match(err.message, /UTR-9876543210/);
        return true;
      },
      'Server must reject duplicate merchant + UTR/slip + amount + date with clear error'
    );

    // 3. Post duplicate with same SLIP number (even if refNumber is null)
    console.log('3. Attempting duplicate manual swipe with same SLIP number...');
    const slipSwipe1 = await processSwipeTransaction(client, {
      merchantId: 'MID9001',
      amountPaise: 250000n,
      channel: 'pinelabs',
      slipNumber: 'SLIP-UNIQUE-99',
      idempotencyKey: 'IDEMP-SLIP-1'
    });

    await assert.rejects(
      async () => {
        await processSwipeTransaction(client, {
          merchantId: 'MID9001',
          amountPaise: 250000n,
          channel: 'pinelabs',
          slipNumber: 'SLIP-UNIQUE-99', // DUPLICATE SLIP
          idempotencyKey: 'IDEMP-SLIP-2'
        });
      },
      (err) => {
        assert.match(err.message, /DUPLICATE_SWIPE/);
        assert.match(err.message, /SLIP-UNIQUE-99/);
        return true;
      },
      'Server must reject duplicate slip number'
    );

    console.log('✅ TEST PASSED: Duplicate manual swipe entries strictly rejected with clear error.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
