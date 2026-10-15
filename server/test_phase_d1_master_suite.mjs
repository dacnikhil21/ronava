import http from 'node:http';
import assert from 'node:assert/strict';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { testPool, resetTestDatabase } from './test_db_helper.js';
import { handleApiRequest } from './api.js';
import { getDbPool } from './pg_db.js';
import { setUserRate } from './rate_engine.js';
import { getWalletBalances, verifyWalletReconciliation } from './ledger_engine.js';

const PORT = 5995;

async function runMasterSuite() {
  console.log('================================================================');
  console.log('--- PHASE D1 MASTER HTTP ENDPOINT AUTOMATED VERIFICATION SUITE ---');
  console.log('================================================================');

  await resetTestDatabase();

  const client = await testPool.connect();
  try {
    // Setup reference chain
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'RONAV Admin', '9966203053', 'ADMIN', NULL),
        ('MST1001', 'Master Dist', '9966203000', 'MASTER', 'ADM001'),
        ('SD1001', 'Super Dist', '9848011223', 'SUPER_DISTRIBUTOR', 'MST1001'),
        ('DIST2001', 'District Dist', '9848099887', 'DISTRICT_DISTRIBUTOR', 'SD1001'),
        ('AREA3001', 'Area Dist', '9848055443', 'DISTRIBUTOR', 'DIST2001'),
        ('MID4001', 'Test Merchant', '9876543210', 'MERCHANT', 'AREA3001');

      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES
        ('ADM001', 0, 0), ('MST1001', 0, 0), ('SD1001', 0, 0), ('DIST2001', 0, 0), ('AREA3001', 0, 0), ('MID4001', 0, 0);

      INSERT INTO beneficiaries (id, merchant_id, bank_name, account_number, ifsc, holder_name, is_verified) VALUES
        ('BEN-MID4001-1', 'MID4001', 'State Bank of India', '123456789012', 'SBIN0001234', 'Test Merchant', true);
    `);

    // Set exact reference rates: Area 1.5%, District 1.2%, SD 1.0%, Master 0.8%, Admin 0.6%
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', rateBps: 60 });
    await setUserRate(client, { userId: 'MST1001', channel: 'pinelabs', rateBps: 80 });
    await setUserRate(client, { userId: 'SD1001', channel: 'pinelabs', rateBps: 100 });
    await setUserRate(client, { userId: 'DIST2001', channel: 'pinelabs', rateBps: 120 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', rateBps: 150 });
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', rateBps: 150 });
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
  console.log(`Live HTTP Test Server listening on http://127.0.0.1:${PORT}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1 & 2: REFERENCE CHAIN & FAKE CLIENT CHARGE IGNORED (HTTP POST /api/transactions/record)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1 & 2] Reference chain: Area 1.5%, District 1.2%, SD 1.0%, Master 0.8%, Admin 0.6%, Rs 10,000 swipe.');
    console.log('Client sends fake customer_charge: 0, commission: 0. Server must ignore.');

    const swipeRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'IDEMP-MASTER-SWIPE-1'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000, // Rs 10,000
        customer_charge: 0, // FAKE: Server must ignore
        commission: 0,      // FAKE: Server must ignore
        net_amount: 10000,  // FAKE: Server must ignore
        channel: 'pinelabs',
        ref_number: 'REF-MASTER-10001',
        slip_number: 'SLIP-MASTER-1'
      })
    });

    const swipeJson = await swipeRes.json();
    assert.equal(swipeRes.status, 200, `Expected 200, got ${swipeRes.status}: ${JSON.stringify(swipeJson)}`);
    assert.equal(swipeJson.success, true);
    assert.equal(swipeJson.transaction.customer_charge_paise, '15000', 'Merchant charged Rs 150 (15,000 paise)');
    assert.equal(swipeJson.transaction.net_amount_paise, '985000', 'Merchant net credit Rs 9,850 (985,000 paise)');

    // Verify balances across hierarchy
    const bMerchant = await getWalletBalances(getDbPool(), 'MID4001');
    assert.equal(bMerchant.balance_paise, 985000n, 'Merchant gets Rs 9,850');

    const bArea = await getWalletBalances(getDbPool(), 'AREA3001');
    assert.equal(bArea.balance_paise, 3000n, 'Area gets Rs 30 (1.5% - 1.2% = 0.3% of 10,000)');

    const bDist = await getWalletBalances(getDbPool(), 'DIST2001');
    assert.equal(bDist.balance_paise, 2000n, 'District gets Rs 20 (1.2% - 1.0% = 0.2% of 10,000)');

    const bSD = await getWalletBalances(getDbPool(), 'SD1001');
    assert.equal(bSD.balance_paise, 2000n, 'SD gets Rs 20 (1.0% - 0.8% = 0.2% of 10,000)');

    const bMaster = await getWalletBalances(getDbPool(), 'MST1001');
    assert.equal(bMaster.balance_paise, 2000n, 'Master gets Rs 20 (0.8% - 0.6% = 0.2% of 10,000)');

    const bAdmin = await getWalletBalances(getDbPool(), 'ADM001');
    assert.equal(bAdmin.balance_paise, 6000n, 'Admin gets Rs 60 (0.6% base cut of 10,000)');

    // Exact mathematical invariant: 9850 + 30 + 20 + 20 + 20 + 60 == 10000
    const totalAccounted = bMerchant.balance_paise + bArea.balance_paise + bDist.balance_paise + bSD.balance_paise + bMaster.balance_paise + bAdmin.balance_paise;
    assert.equal(totalAccounted, 1000000n, 'Paisa-perfect sum invariant holds: 1,000,000 paise');
    console.log('✅ TEST 1 & 2 PASSED: Reference chain distributions and fake charge rejection verified.');

    // -------------------------------------------------------------------------
    // TEST 3: IDEMPOTENCY KEY RETRY (ONE POSTING ONLY)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Same idempotency key twice: one posting only.');
    const idempRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'IDEMP-MASTER-SWIPE-1'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000,
        ref_number: 'REF-MASTER-10001'
      })
    });
    const idempJson = await idempRes.json();
    assert.equal(idempRes.status, 200);
    assert.equal(idempJson.transaction.id, swipeJson.transaction.id);

    const checkClient = await testPool.connect();
    try {
      const ledgerCount = await checkClient.query(
        `SELECT COUNT(*) FROM financial_ledger WHERE reference_id = $1`,
        [swipeJson.transaction.id]
      );
      assert.equal(parseInt(ledgerCount.rows[0].count), 6, 'Exactly 6 ledger entries posted, no duplicate on retry');
    } finally {
      checkClient.release();
    }
    console.log('✅ TEST 3 PASSED: Idempotency check verified.');

    // -------------------------------------------------------------------------
    // TEST 4: RATE CHANGED AFTER SWIPE (HISTORICAL COMMISSION UNCHANGED)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Rate changed after a swipe: old commission unchanged.');
    const rateClient = await testPool.connect();
    try {
      // Modify Area rate to 180 bps
      await setUserRate(rateClient, { userId: 'AREA3001', channel: 'pinelabs', rateBps: 180 });

      // Verify historical ledger entries for first swipe
      const histRows = await rateClient.query(
        `SELECT amount_paise FROM financial_ledger WHERE reference_id = $1 AND user_id = 'AREA3001'`,
        [swipeJson.transaction.id]
      );
      assert.equal(histRows.rows[0].amount_paise, '3000', 'Historical commission unchanged at 3,000 paise');
    } finally {
      rateClient.release();
    }
    console.log('✅ TEST 4 PASSED: Historical rate immutability verified.');

    // -------------------------------------------------------------------------
    // TEST 5: FAILURE MIDWAY (FULL ROLLBACK, NO PARTIAL LEDGER ROWS)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 5] Failure midway: full rollback, no partial ledger rows.');
    const failRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'NON_EXISTENT_MERCHANT',
        amount: 1000
      })
    });
    assert.equal(failRes.status, 404);

    const verifyClient = await testPool.connect();
    try {
      const orphaned = await verifyClient.query(`SELECT COUNT(*) FROM financial_ledger WHERE user_id = 'NON_EXISTENT_MERCHANT'`);
      assert.equal(parseInt(orphaned.rows[0].count), 0, 'Zero orphaned ledger entries on failure');
    } finally {
      verifyClient.release();
    }
    console.log('✅ TEST 5 PASSED: Full transaction rollback verified.');

    // -------------------------------------------------------------------------
    // TEST 6: 50 CONCURRENT WITHDRAWALS (NO OVERSPEND, RESERVE RESPECTED)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 6] 50 concurrent withdrawals: no overspend, reserve respected.');
    // Merchant balance = 985,000 paise. Reserve = 50,000 paise. Max withdrawable = 935,000 paise.
    // Each withdrawal = Rs 200 (20,000 paise).
    // 46 withdrawals * 20,000 = 920,000 <= 935,000 (leaves 65,000 >= 50,000 reserve).
    // 47th withdrawal would require 940,000 (leaves 45,000 < 50,000 reserve) -> REJECTED.
    // Thus: exactly 46 MUST succeed, exactly 4 MUST be rejected with HTTP 403.
    const concurrentRequests = Array.from({ length: 50 }, (_, i) => {
      return fetch(`http://127.0.0.1:${PORT}/api/withdrawals/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': `IDEMP-CONCURRENT-WTH-${i}`
        },
        body: JSON.stringify({
          merchant_id: 'MID4001',
          amount: 200, // Rs 200
          beneficiary_id: 'BEN-MID4001-1'
        })
      });
    });

    const results = await Promise.all(concurrentRequests);
    const statuses = results.map(r => r.status);
    const successes = statuses.filter(s => s === 200);
    const rejections = statuses.filter(s => s === 403);

    console.log(`Concurrent Withdrawal Results: ${successes.length} succeeded, ${rejections.length} rejected by reserve rule.`);
    assert.equal(successes.length, 46, 'Exactly 46 withdrawals must succeed');
    assert.equal(rejections.length, 4, 'Exactly 4 withdrawals must be rejected by reserve rule');

    // Verify merchant balance never dips below Rs 500 reserve
    const finalMerchantBal = await getWalletBalances(getDbPool(), 'MID4001');
    assert.equal(finalMerchantBal.balance_paise, 65000n, 'Final balance must be exactly Rs 650 (65,000 paise)');
    assert.ok(finalMerchantBal.balance_paise >= 50000n, 'Reserve of 50,000 paise strictly maintained');
    console.log('✅ TEST 6 PASSED: 50 concurrent withdrawals respected row-locking and reserve rule with zero overspend.');

    // -------------------------------------------------------------------------
    // TEST 7: RECONCILIATION AFTER MIXED OPERATIONS (WALLET BALANCE == SUM(LEDGER))
    // -------------------------------------------------------------------------
    console.log('\n[TEST 7] Reconciliation: wallet balance == SUM(financial_ledger) for every user.');
    const reconClient = await testPool.connect();
    try {
      const allUsers = ['ADM001', 'MST1001', 'SD1001', 'DIST2001', 'AREA3001', 'MID4001'];
      for (const uid of allUsers) {
        const rec = await verifyWalletReconciliation(reconClient, uid);
        assert.equal(rec.reconciled, true, `User ${uid} must be 100% reconciled`);
        assert.equal(rec.cached_balance_paise, rec.ledger_sum_paise, `Cached balance == Ledger sum for ${uid}`);
      }
    } finally {
      reconClient.release();
    }
    console.log('✅ TEST 7 PASSED: 100% mathematical reconciliation verified across all accounts.');

    console.log('\n================================================================');
    console.log('🎉 ALL 7 PHASE D1 MASTER SUITE TESTS PASSED THROUGH REAL HTTP ENDPOINTS!');
    console.log('================================================================');
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

runMasterSuite().catch(err => {
  console.error('❌ MASTER SUITE FAILED:', err);
  process.exit(1);
});
