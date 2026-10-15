import assert from 'node:assert/strict';
import http from 'node:http';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { postLedgerEntry } from './ledger_engine.js';
import { handleApiRequest } from './api.js';

const PORT = 5994;

async function testPhaseD2BackendEndpoints() {
  console.log('=== TEST SUITE: Phase D2 Backend Supporting Endpoints ===');
  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // 1. Setup hierarchy: Admin (ADM001) -> Dist (DIST001) -> Merchant (MID001)
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'Admin', '9999000001', 'ADMIN', NULL),
        ('DIST001', 'Distributor One', '9999000002', 'DISTRIBUTOR', 'ADM001'),
        ('MID001', 'Merchant One', '9999000003', 'MERCHANT', 'DIST001')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Setup rates: Admin 60 bps, Dist 100 bps T1 / 120 bps Instant
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 80 });
    await setUserRate(client, { userId: 'DIST001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
    await setUserRate(client, { userId: 'DIST001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 120 });
    await setUserRate(client, { userId: 'MID001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    await setUserRate(client, { userId: 'MID001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 180 });

    // Mark merchant rates needs_review to test review visibility
    await client.query(`UPDATE user_channel_rates SET needs_review = TRUE WHERE user_id = 'MID001'`);

    // Post a real ledger commission of Rs 50 (5,000 paise) to Dist
    await postLedgerEntry(client, {
      userId: 'DIST001',
      type: 'commission',
      amountPaise: 5000n,
      referenceId: 'TXN-TEST-001',
      referenceType: 'TRANSACTION',
      channel: 'pinelabs'
    });

    // Record a transaction for merchant: Rs 10,000
    await client.query(`
      INSERT INTO transactions (id, merchant_id, amount_paise, customer_charge_paise, net_amount_paise, type, channel, settlement_mode, status)
      VALUES ('TXN-TEST-001', 'MID001', 1000000, 15000, 985000, 'POS_SWIPE', 'pinelabs', 'T1', 'APPROVED')
      ON CONFLICT (id) DO NOTHING;
    `);
  } finally {
    client.release();
  }

  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test HTTP server listening on http://127.0.0.1:${PORT}`);

  try {
    // 1. GET /api/settings
    console.log('1. Testing GET /api/settings...');
    const setRes = await fetch(`http://127.0.0.1:${PORT}/api/settings`);
    assert.equal(setRes.status, 200, 'GET /api/settings must return 200');
    const setData = await setRes.json();
    assert.equal(setData.success, true);
    assert(setData.settings.reserve_amount_paise, 'Settings must include reserve_amount_paise');
    assert.equal(setData.settings.support_phone, '9966203053');

    // 2. GET /api/rates/config
    console.log('2. Testing GET /api/rates/config?userId=MID001&creatorId=DIST001...');
    const rateRes = await fetch(`http://127.0.0.1:${PORT}/api/rates/config?userId=MID001&creatorId=DIST001`);
    assert.equal(rateRes.status, 200, 'GET /api/rates/config must return 200');
    const rateData = await rateRes.json();
    assert.equal(rateData.success, true);
    // Creator minimums: Dist has 100 bps T1 / 120 bps Instant
    assert.equal(rateData.creator_rates.pinelabs.t1.rate_bps, 100);
    assert.equal(rateData.creator_rates.pinelabs.instant.rate_bps, 120);
    // User rates: Merchant has 150 bps T1 / 180 bps Instant with needs_review = true
    assert.equal(rateData.user_rates.pinelabs.T1.rate_bps, 150);
    assert.equal(rateData.user_rates.pinelabs.T1.needs_review, true);
    assert.equal(rateData.user_rates.pinelabs.INSTANT.needs_review, true);

    // 3. GET /api/users/:id/financial-summary
    console.log('3. Testing GET /api/users/DIST001/financial-summary...');
    const finRes = await fetch(`http://127.0.0.1:${PORT}/api/users/DIST001/financial-summary`);
    const finData = await finRes.json();
    assert.equal(finRes.status, 200, `GET /api/users/DIST001/financial-summary must return 200: ${JSON.stringify(finData)}`);
    assert.equal(finData.success, true);
    assert.equal(finData.total_commission_paise, '5000', 'Commission must come from financial_ledger');
    assert.equal(finData.total_commission_rupees, '50.00');

    // 4. GET /api/network/downstream
    console.log('4. Testing GET /api/network/downstream?creatorId=ADM001...');
    const netRes = await fetch(`http://127.0.0.1:${PORT}/api/network/downstream?creatorId=ADM001`);
    const netData = await netRes.json();
    assert.equal(netRes.status, 200, `GET /api/network/downstream must return 200: ${JSON.stringify(netData)}`);
    assert.equal(netData.success, true);
    assert.equal(netData.partner_count, 2, 'Admin should have 2 downline partners');
    const distPartner = netData.partners.find(p => p.id === 'DIST001');
    assert(distPartner, 'Distributor must be in partner list');
    assert.equal(distPartner.total_commission_paise, '5000', 'Distributor commission must be 5,000 paise from ledger');

    console.log('✅ ALL PHASE D2 BACKEND SUPPORTING ENDPOINT TESTS PASSED!');
  } finally {
    await new Promise(r => server.close(r));
    await pool.end();
  }
}

testPhaseD2BackendEndpoints()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
