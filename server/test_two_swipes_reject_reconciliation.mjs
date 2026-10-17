import http from 'http';
import assert from 'assert/strict';
import pg from 'pg';
import { handleApiRequest } from './api.js';
import { cleanAndReseed } from './clean_and_reseed.mjs';

const { Pool } = pg;
const connectionString = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
const pool = new Pool({ connectionString });

const TEST_PORT = 5992;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTest() {
  console.log('--- TEST: RECORD 2 SWIPES, REJECT BOTH, VERIFY FULL RECONCILIATION ---');

  // 1. Clean and reseed ronav_test_db
  console.log('1. Cleaning & reseeding ronav_test_db...');
  await cleanAndReseed();

  // 2. Fetch initial wallet balances
  const initialWalletsRes = await pool.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
  const initialWallets = {};
  initialWalletsRes.rows.forEach(r => { initialWallets[r.user_id] = r.balance_paise; });
  console.log('   Initial starting wallet balances:', initialWallets);

  // 3. Start real HTTP server on TEST_PORT
  console.log(`2. Starting real HTTP server on port ${TEST_PORT}...`);
  const server = http.createServer(async (req, res) => {
    await handleApiRequest(req, res);
  });
  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // 4. Record Swipe 1 (Rs 10,000)
    console.log('3. Recording Swipe 1 (Rs 10,000 Pine Labs T+1)...');
    const swipe1Res = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'MID4001',
        'x-user-role': 'MERCHANT'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        notes: 'Pine Labs POS Swipe 1',
        ref_number: 'REF-SWIPE-1'
      })
    });
    const swipe1Data = await swipe1Res.json();
    assert.equal(swipe1Data.success, true);
    const txn1Id = swipe1Data.transaction.id;
    console.log(`   ✓ Swipe 1 recorded: ${txn1Id}`);

    // 5. Record Swipe 2 (Rs 10,000)
    console.log('4. Recording Swipe 2 (Rs 10,000 Pine Labs T+1)...');
    const swipe2Res = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'MID4001',
        'x-user-role': 'MERCHANT'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount_paise: 1000000,
        channel: 'pinelabs',
        mode: 'T1',
        settlement_type: 'T1',
        notes: 'Pine Labs POS Swipe 2',
        ref_number: 'REF-SWIPE-2'
      })
    });
    const swipe2Data = await swipe2Res.json();
    assert.equal(swipe2Data.success, true);
    const txn2Id = swipe2Data.transaction.id;
    console.log(`   ✓ Swipe 2 recorded: ${txn2Id}`);

    // Verify stats with 2 active swipes
    const activePending = await (await fetch(`${BASE_URL}/api/admin/pending`)).json();
    console.log('   Stats with 2 active swipes:', activePending.stats);
    assert.equal(activePending.stats.totalVolume, 20000);
    assert.equal(activePending.stats.totalFeesCollected, 300);
    assert.equal(activePending.stats.partnerCommissions, 180);
    assert.equal(activePending.stats.adminNetProfit, 120);

    // 6. Reject Swipe 1
    console.log(`5. Rejecting Swipe 1 (${txn1Id})...`);
    const reject1Res = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'ADM001',
        'x-user-role': 'ADMIN'
      },
      body: JSON.stringify({
        transaction_id: txn1Id,
        action: 'REJECT',
        reason: 'Customer requested cancellation'
      })
    });
    const reject1Data = await reject1Res.json();
    assert.equal(reject1Data.success, true);
    console.log('   ✓ Swipe 1 rejected successfully');

    // 7. Reject Swipe 2
    console.log(`6. Rejecting Swipe 2 (${txn2Id})...`);
    const reject2Res = await fetch(`${BASE_URL}/api/admin/verify-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'ADM001',
        'x-user-role': 'ADMIN'
      },
      body: JSON.stringify({
        transaction_id: txn2Id,
        action: 'REJECT',
        reason: 'Double swipe error'
      })
    });
    const reject2Data = await reject2Res.json();
    assert.equal(reject2Data.success, true);
    console.log('   ✓ Swipe 2 rejected successfully');

    // 8. Query GET /api/admin/pending (The shared single source of truth)
    console.log('7. Verifying /api/admin/pending after both swipes rejected...');
    const finalPendingRes = await fetch(`${BASE_URL}/api/admin/pending`, {
      headers: {
        'x-user-id': 'ADM001',
        'x-user-role': 'ADMIN'
      }
    });
    const finalPending = await finalPendingRes.json();
    const stats = finalPending.stats;
    console.log('   Final Stats from /api/admin/pending:', stats);

    assert.equal(stats.totalVolume, 0, `Expected totalVolume 0, got ${stats.totalVolume}`);
    assert.equal(stats.totalFeesCollected, 0, `Expected totalFeesCollected 0, got ${stats.totalFeesCollected}`);
    assert.equal(stats.partnerCommissions, 0, `Expected partnerCommissions 0, got ${stats.partnerCommissions}`);
    assert.equal(stats.adminNetProfit, 0, `Expected adminNetProfit 0, got ${stats.adminNetProfit}`);
    assert.equal(stats.pineVolume, 0, `Expected pineVolume 0, got ${stats.pineVolume}`);
    assert.equal(stats.tierTotals.master, 0, `Expected master tier total 0, got ${stats.tierTotals.master}`);
    assert.equal(stats.tierTotals.super, 0, `Expected super tier total 0, got ${stats.tierTotals.super}`);
    assert.equal(stats.tierTotals.district, 0, `Expected district tier total 0, got ${stats.tierTotals.district}`);
    assert.equal(stats.tierTotals.distributor, 0, `Expected distributor tier total 0, got ${stats.tierTotals.distributor}`);
    assert.equal(stats.tierTotals.merchant, 0, `Expected merchant tier total 0, got ${stats.tierTotals.merchant}`);
    assert.equal(stats.tierTotals.companyNet, 0, `Expected companyNet 0, got ${stats.tierTotals.companyNet}`);
    console.log('   ✓ All pending stats NET of reversals are strictly 0');

    // 9. Verify every user's wallet is back to its starting balance
    console.log('8. Checking database wallets table against starting balances...');
    const currentWalletsRes = await pool.query('SELECT user_id, balance_paise FROM wallets ORDER BY user_id');
    for (const row of currentWalletsRes.rows) {
      const start = initialWallets[row.user_id];
      assert.equal(
        row.balance_paise, 
        start, 
        `Wallet for ${row.user_id} should be ${start}, got ${row.balance_paise}`
      );
    }
    console.log('   ✓ Every wallet is strictly back to its exact starting balance');

    // 10. Verify financial_ledger NET per user
    console.log('9. Checking financial_ledger net per user...');
    const ledgerUserNet = await pool.query(`
      SELECT user_id, SUM(amount_paise) as net_paise 
      FROM financial_ledger 
      GROUP BY user_id
    `);
    for (const r of ledgerUserNet.rows) {
      assert.equal(BigInt(r.net_paise), 0n, `User ${r.user_id} net paise must be 0, got ${r.net_paise}`);
    }
    console.log('   ✓ All user ledger nets are strictly 0');

    // 11. Verify user financial summary endpoint
    for (const u of ['MID4001', 'AREA3001', 'DIST2001', 'SD1001', 'MST1001', 'ADM001']) {
      const summaryRes = await fetch(`${BASE_URL}/api/users/${u}/financial-summary`);
      const summary = await summaryRes.json();
      assert.equal(summary.total_commission_rupees, '0.00', `Commission for ${u} must be 0.00, got ${summary.total_commission_rupees}`);
      assert.equal(summary.total_sales_rupees, '0.00', `Sales for ${u} must be 0.00, got ${summary.total_sales_rupees}`);
    }
    console.log('   ✓ User financial summary endpoints return 0.00 for all users');

    console.log('\n--- ALL ASSERTIONS PASSED: ZERO LEAKAGE, EXACT ZERO RECONCILIATION ---');
  } finally {
    server.close();
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
