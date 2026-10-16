process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import http from 'http';
import assert from 'node:assert/strict';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { handleApiRequest } from './api.js';

const PORT = 5999;
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PAISE DISPLAY & SERIALIZATION VERIFICATION SUITE');
  console.log('================================================================\n');

  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // 1. Seed Reference Hierarchy for test
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id, password) VALUES
        ('ADM001', 'Admin', '9999000000', 'ADMIN', NULL, 'Ronav@123'),
        ('MST1001', 'Master Dist', '9966203000', 'MASTER', 'ADM001', 'Ronav@123'),
        ('SD1001', 'Super Dist', '9848011223', 'SUPER_DISTRIBUTOR', 'MST1001', 'Ronav@123'),
        ('DIST2001', 'District Dist', '9848099887', 'DISTRICT_DISTRIBUTOR', 'SD1001', 'Ronav@123'),
        ('AREA3001', 'Area Dist', '9848055443', 'DISTRIBUTOR', 'DIST2001', 'Ronav@123'),
        ('MID4001', 'Test Merchant Store', '9876543210', 'MERCHANT', 'AREA3001', 'Ronav@123');

      INSERT INTO wallets (user_id, balance_paise, held_paise) VALUES
        ('ADM001', 0, 0), ('MST1001', 0, 0), ('SD1001', 0, 0),
        ('DIST2001', 0, 0), ('AREA3001', 0, 0), ('MID4001', 0, 0);

      INSERT INTO merchant_pos (id, merchant_id, provider, terminal_id, commission_rate, commission_rate_t1, commission_rate_instant)
      VALUES ('POS-PL-4001', 'MID4001', 'Pine Labs', 'PL-4001-01', 1.50, 1.50, 1.80);
    `);

    // Charged rate hierarchy: Master 60, SD 80, District 100, Area 120, Merchant 150
    await setUserRate(client, { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
    await setUserRate(client, { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 80 });
    await setUserRate(client, { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
  } finally {
    client.release();
  }

  // Start HTTP Server
  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Live HTTP Test Server listening on ${BASE_URL}\n`);

  try {
    // -----------------------------------------------------------------
    // TEST 1: Record Rs 10,000 Swipe as MID4001
    // -----------------------------------------------------------------
    console.log('1. Recording Rs 10,000 swipe on Pine Labs T+1 as MID4001...');
    const swipeRes = await fetch(`${BASE_URL}/api/transactions/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'IDEMP-TEST-PAISE-SWIPE-10K'
      },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        slip_number: 'SLIP-PAISE-10K',
        ref_number: 'REF-PAISE-10K'
      })
    });
    const swipeJson = await swipeRes.json();
    assert.equal(swipeRes.status, 200, `Swipe must return 200: ${JSON.stringify(swipeJson)}`);
    assert.equal(swipeJson.success, true);
    console.log('   ✓ Swipe recorded successfully. Txn ID:', swipeJson.transaction.id);

    // -----------------------------------------------------------------
    // TEST 2: GET /api/admin/pending must NOT fail with 'column amount does not exist'
    // -----------------------------------------------------------------
    console.log('\n2. Testing GET /api/admin/pending (must succeed and return serialized rupee fields)...');
    const pendingRes = await fetch(`${BASE_URL}/api/admin/pending`);
    const pendingJson = await pendingRes.json();
    assert.equal(pendingRes.status, 200, `Expected 200 from /api/admin/pending, got ${pendingRes.status}: ${JSON.stringify(pendingJson)}`);
    assert.equal(pendingJson.success, true, 'success must be true');

    // Verify allTransactions contains the swipe with rupee values
    assert.ok(Array.isArray(pendingJson.allTransactions), 'allTransactions must be an array');
    assert.ok(pendingJson.allTransactions.length > 0, 'allTransactions must contain transactions');
    const adminTxn = pendingJson.allTransactions.find(t => t.id === swipeJson.transaction.id);
    assert.ok(adminTxn, 'Admin allTransactions must contain the recorded swipe');
    
    // Explicit checks: must NOT be undefined or 0
    assert.equal(adminTxn.amount, '10000.00', 'adminTxn.amount must be "10000.00" in Rupees');
    assert.equal(adminTxn.customer_charge, '150.00', 'adminTxn.customer_charge must be "150.00" in Rupees');
    assert.equal(adminTxn.net_amount, '9850.00', 'adminTxn.net_amount must be "9850.00" in Rupees');
    assert.equal(pendingJson.stats.totalVolume, 10000, 'stats.totalVolume must be 10000 (Rupees), not 0 or NaN');
    console.log('   ✓ GET /api/admin/pending successfully returns serialized rupee fields.');

    // -----------------------------------------------------------------
    // TEST 3: GET /api/transactions/merchant/MID4001 (Recent Swipes & History)
    // -----------------------------------------------------------------
    console.log('\n3. Testing GET /api/transactions/merchant/MID4001 (Merchant Recent Swipes & History)...');
    const mercTxnRes = await fetch(`${BASE_URL}/api/transactions/merchant/MID4001`);
    const mercTxnJson = await mercTxnRes.json();
    assert.equal(mercTxnRes.status, 200);
    assert.equal(mercTxnJson.success, true);
    assert.ok(Array.isArray(mercTxnJson.transactions), 'transactions must be an array');
    const mercTxn = mercTxnJson.transactions.find(t => t.id === swipeJson.transaction.id);
    assert.ok(mercTxn, 'Merchant transactions must contain the recorded swipe');

    assert.equal(mercTxn.amount, '10000.00', 'mercTxn.amount must be "10000.00"');
    assert.equal(mercTxn.customer_charge, '150.00', 'mercTxn.customer_charge must be "150.00"');
    assert.equal(mercTxn.net_amount, '9850.00', 'mercTxn.net_amount must be "9850.00"');
    console.log('   ✓ Merchant transaction list returns amount: ₹10,000.00, fee: ₹150.00, net: ₹9,850.00');

    // -----------------------------------------------------------------
    // TEST 4: GET /api/public/stats (Public and Overview Stats)
    // -----------------------------------------------------------------
    console.log('\n4. Testing GET /api/public/stats (must not fail on column amount)...');
    const pubRes = await fetch(`${BASE_URL}/api/public/stats`);
    const pubJson = await pubRes.json();
    assert.equal(pubRes.status, 200, `Expected 200, got ${pubRes.status}: ${JSON.stringify(pubJson)}`);
    assert.equal(pubJson.success, true);
    assert.equal(pubJson.stats.totalVolume, 10000, 'totalVolume must be 10000 in rupees');
    console.log('   ✓ Public stats returns totalVolume: ₹10,000');

    // -----------------------------------------------------------------
    // TEST 5: Upline Earnings Verification
    // -----------------------------------------------------------------
    console.log('\n5. Verifying upline earnings: Area 30, District 20, SD 20, Master 20, Admin 60...');
    const areaSum = await (await fetch(`${BASE_URL}/api/users/AREA3001/financial-summary`)).json();
    assert.equal(areaSum.total_commission_rupees, '30.00', 'Area commission must be ₹30.00');

    const distSum = await (await fetch(`${BASE_URL}/api/users/DIST2001/financial-summary`)).json();
    assert.equal(distSum.total_commission_rupees, '20.00', 'District commission must be ₹20.00');

    const sdSum = await (await fetch(`${BASE_URL}/api/users/SD1001/financial-summary`)).json();
    assert.equal(sdSum.total_commission_rupees, '20.00', 'SD commission must be ₹20.00');

    const mstSum = await (await fetch(`${BASE_URL}/api/users/MST1001/financial-summary`)).json();
    assert.equal(mstSum.total_commission_rupees, '20.00', 'Master commission must be ₹20.00');

    const adminWallet = await (await fetch(`${BASE_URL}/api/wallet/ADM001`)).json();
    assert.equal(adminWallet.wallet.available_balance, 60, 'Admin wallet balance must be ₹60.00');

    const mercWallet = await (await fetch(`${BASE_URL}/api/wallet/MID4001`)).json();
    assert.equal(mercWallet.wallet.available_balance, 9850, 'Merchant wallet balance must be ₹9,850.00');
    console.log('   ✓ All upline earnings and wallet balances strictly verified.');

    console.log('\n================================================================');
    console.log('🎉 ALL PAISE DISPLAY & SERIALIZATION TESTS PASSED!');
    console.log('================================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
