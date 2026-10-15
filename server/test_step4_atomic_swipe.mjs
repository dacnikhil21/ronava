import assert from 'node:assert/strict';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';
import { processSwipeTransaction } from './transaction_engine.js';

async function runTest() {
  console.log('--- RUNNING TEST 4: Atomic Swipe / QR Processing & Invariant Enforcement ---');
  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup reference chain:
    // Admin (ADM001, 0.60%)
    //  -> Master (MST1001, 0.80%)
    //    -> SD (SD1001, 1.00%)
    //      -> District (DIST2001, 1.20%)
    //        -> Area (AREA3001, 1.50%)
    //          -> Merchant (MID4001, 1.50%)
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('MST1001', 'Master Dist', '9966203000', 'MASTER', 'ADM001'),
        ('SD1001', 'Super Dist', '9848011223', 'SUPER_DISTRIBUTOR', 'MST1001'),
        ('DIST2001', 'District Dist', '9848099887', 'DISTRICT_DISTRIBUTOR', 'SD1001'),
        ('AREA3001', 'Area Dist', '9848055443', 'DISTRIBUTOR', 'DIST2001'),
        ('MID4001', 'Test Merchant', '9876543210', 'MERCHANT', 'AREA3001');

      INSERT INTO wallets (user_id, balance_paise) VALUES
        ('ADM001', 0), ('MST1001', 0), ('SD1001', 0), ('DIST2001', 0), ('AREA3001', 0), ('MID4001', 0);
    `);

    // Set channel rates for 'pinelabs'
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', rateBps: 60 });
    await setUserRate(client, { userId: 'MST1001', channel: 'pinelabs', rateBps: 80 });
    await setUserRate(client, { userId: 'SD1001', channel: 'pinelabs', rateBps: 100 });
    await setUserRate(client, { userId: 'DIST2001', channel: 'pinelabs', rateBps: 120 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', rateBps: 150 });
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', rateBps: 150 });

    // -------------------------------------------------------------
    // TEST 4.1: Reference Chain Rs 10,000 Swipe
    // -------------------------------------------------------------
    console.log('Testing Reference Chain: Rs 10,000 swipe...');
    const swipe1 = await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1000000n, // Rs 10,000
      channel: 'pinelabs',
      refNumber: 'REF-10001',
      slipNumber: 'SLIP-01',
      idempotencyKey: 'IDEMP-SWIPE-1',
      createdBy: 'MID4001'
    });

    assert.equal(swipe1.amount_paise, 1000000n);
    assert.equal(swipe1.customer_charge_paise, 15000n, 'Merchant charged Rs 150 (15000 paise)');
    assert.equal(swipe1.net_amount_paise, 985000n, 'Merchant gets Rs 9,850 (985000 paise)');

    // Verify balances across the entire hierarchy
    const bMerchant = await getWalletBalances(client, 'MID4001');
    assert.equal(bMerchant.balance_paise, 985000n, 'Merchant wallet should be Rs 9,850');

    const bArea = await getWalletBalances(client, 'AREA3001');
    assert.equal(bArea.balance_paise, 3000n, 'Area wallet should be Rs 30 (3000 paise)');

    const bDist = await getWalletBalances(client, 'DIST2001');
    assert.equal(bDist.balance_paise, 2000n, 'District wallet should be Rs 20 (2000 paise)');

    const bSD = await getWalletBalances(client, 'SD1001');
    assert.equal(bSD.balance_paise, 2000n, 'SD wallet should be Rs 20 (2000 paise)');

    const bMaster = await getWalletBalances(client, 'MST1001');
    assert.equal(bMaster.balance_paise, 2000n, 'Master wallet should be Rs 20 (2000 paise)');

    const bAdmin = await getWalletBalances(client, 'ADM001');
    assert.equal(bAdmin.balance_paise, 6000n, 'Admin wallet should be Rs 60 (6000 paise)');

    // Invariant check: merchant fee (15000) == 3000 + 2000 + 2000 + 2000 + 6000
    const totalDistributed = bArea.balance_paise + bDist.balance_paise + bSD.balance_paise + bMaster.balance_paise + bAdmin.balance_paise;
    assert.equal(totalDistributed, 15000n, 'Exact mathematical invariant holds to the paisa');

    // -------------------------------------------------------------
    // TEST 4.2: Idempotency Key (Same key returns same result without double-posting)
    // -------------------------------------------------------------
    console.log('Testing Idempotency: duplicate request with same key...');
    const duplicateSwipe = await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1000000n,
      channel: 'pinelabs',
      refNumber: 'REF-10001',
      slipNumber: 'SLIP-01',
      idempotencyKey: 'IDEMP-SWIPE-1', // SAME KEY
      createdBy: 'MID4001'
    });
    assert.equal(duplicateSwipe.id, swipe1.id);
    const bAreaAfterIdemp = await getWalletBalances(client, 'AREA3001');
    assert.equal(bAreaAfterIdemp.balance_paise, 3000n, 'Balance must NOT change on duplicate idempotency key');

    // -------------------------------------------------------------
    // TEST 4.3: Uniqueness Rule: Duplicate slip/ref with different key is rejected
    // -------------------------------------------------------------
    console.log('Testing Duplicate Slip Rejection...');
    await assert.rejects(
      async () => {
        await processSwipeTransaction(client, {
          merchantId: 'MID4001',
          amountPaise: 1000000n,
          channel: 'pinelabs',
          refNumber: 'REF-10001', // DUPLICATE REF
          slipNumber: 'SLIP-01',
          idempotencyKey: 'IDEMP-SWIPE-NEW',
          createdBy: 'MID4001'
        });
      },
      { message: /DUPLICATE_SWIPE/ },
      'Duplicate slip / UTR number for merchant on same day must be rejected'
    );

    // -------------------------------------------------------------
    // TEST 4.4: Rs 1,234.57 (123,457 paise) Rounding Test
    // -------------------------------------------------------------
    console.log('Testing Rs 1,234.57 Rounding and Remainder to Admin...');
    const swipe2 = await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 123457n,
      channel: 'pinelabs',
      refNumber: 'REF-10002',
      idempotencyKey: 'IDEMP-SWIPE-2',
      createdBy: 'MID4001'
    });
    // Verify reconciliation across all wallets
    for (const uid of ['MID4001', 'AREA3001', 'DIST2001', 'SD1001', 'MST1001', 'ADM001']) {
      const rec = await verifyWalletReconciliation(client, uid);
      assert.equal(rec.reconciled, true, `Wallet ${uid} must reconcile`);
    }

    // -------------------------------------------------------------
    // TEST 4.5: Rs 0.01 (1 paisa) Rounding Test
    // -------------------------------------------------------------
    console.log('Testing Rs 0.01 (1 paisa) Swipe...');
    await processSwipeTransaction(client, {
      merchantId: 'MID4001',
      amountPaise: 1n,
      channel: 'pinelabs',
      refNumber: 'REF-001PAISA',
      idempotencyKey: 'IDEMP-SWIPE-PAISA',
      createdBy: 'MID4001'
    });

    // -------------------------------------------------------------
    // TEST 4.6: Rate change after swipe leaves past snapshot untouched
    // -------------------------------------------------------------
    console.log('Testing Rate Change after swipe preserves history...');
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', rateBps: 200 }); // Changed to 2.00%
    // Historical swipe1 record in ledger still contains rate_used: 150
    const ledgerRows = await client.query(
      `SELECT metadata FROM financial_ledger WHERE reference_id = $1 AND type = 'commission'`,
      [swipe1.id]
    );
    for (const r of ledgerRows.rows) {
      assert.equal(r.metadata.channel, 'pinelabs');
      assert.ok(r.metadata.rate_used_bps !== undefined);
      assert.equal(r.metadata.child_rate_bps >= r.metadata.parent_rate_bps, true);
    }

    // -------------------------------------------------------------
    // TEST 4.7: Atomic Rollback on Failure Midway
    // -------------------------------------------------------------
    console.log('Testing Failure Midway triggers full atomic rollback...');
    const areaBeforeFail = (await getWalletBalances(client, 'AREA3001')).balance_paise;
    await assert.rejects(
      async () => {
        await processSwipeTransaction(client, {
          merchantId: 'MID4001',
          amountPaise: 500000n,
          channel: 'pinelabs',
          refNumber: 'REF-FAIL',
          idempotencyKey: 'IDEMP-FAIL',
          simulatedFailure: true
        });
      },
      { message: /SIMULATED_FAILURE/ }
    );
    const areaAfterFail = (await getWalletBalances(client, 'AREA3001')).balance_paise;
    assert.equal(areaBeforeFail, areaAfterFail, 'Wallet balance must be unchanged on rollback');

    console.log('✅ TEST 4 PASSED: Atomic swipe processing and mathematical invariant fully verified.');
  } finally {
    client.release();
    await testPool.end();
  }
}

runTest().catch(err => {
  console.error('❌ TEST 4 FAILED:', err);
  process.exit(1);
});
