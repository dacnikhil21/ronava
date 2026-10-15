import assert from 'node:assert/strict';
import http from 'node:http';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { handleApiRequest } from './api.js';

const PORT = 5996;

async function testSwipeMode() {
  console.log('=== TEST SUITE: Phase D1b Swipe Mode & Commission ===');
  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // 1. Setup Hierarchy: Admin > Master > SD > Dist > Area > Merchant
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'Admin User', '9999000001', 'ADMIN', NULL),
        ('MST1001', 'Master Dist', '9999000002', 'MASTER', 'ADM001'),
        ('SD1001', 'Super Dist', '9999000003', 'SUPER_DISTRIBUTOR', 'MST1001'),
        ('DIST2001', 'District Dist', '9999000004', 'DISTRICT_DISTRIBUTOR', 'SD1001'),
        ('AREA3001', 'Area Dist', '9999000005', 'DISTRIBUTOR', 'DIST2001'),
        ('MID4001', 'Retail Merchant', '9999000006', 'MERCHANT', 'AREA3001')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2. Setup Pine Labs rates with DIFFERENT T1 and INSTANT rates
    // Admin cut is 60 bps for both
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 60 });

    // Master: T1 = 80 bps, Instant = 90 bps
    await setUserRate(client, { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 80 });
    await setUserRate(client, { userId: 'MST1001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 90 });

    // SD: T1 = 100 bps, Instant = 110 bps
    await setUserRate(client, { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 100 });
    await setUserRate(client, { userId: 'SD1001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 110 });

    // Dist: T1 = 120 bps, Instant = 130 bps
    await setUserRate(client, { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
    await setUserRate(client, { userId: 'DIST2001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 130 });

    // Area: T1 = 140 bps, Instant = 160 bps
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 140 });
    await setUserRate(client, { userId: 'AREA3001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 160 });

    // Merchant: T1 = 150 bps (1.5%), Instant = 180 bps (1.8%)
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 150 });
    await setUserRate(client, { userId: 'MID4001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 180 });

    // Also setup QR rate for Merchant (0 bps, NONE mode)
    await setUserRate(client, { userId: 'MID4001', channel: 'qr', settlementMode: 'NONE', rateBps: 0 });
    await setUserRate(client, { userId: 'ADM001', channel: 'qr', settlementMode: 'NONE', rateBps: 0 });
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
  console.log(`Test HTTP server listening on http://127.0.0.1:${PORT}`);

  try {
    // -----------------------------------------------------------------
    // TEST 1: Swipe in INSTANT mode for Pine Labs
    // -----------------------------------------------------------------
    console.log('1. Testing swipe in INSTANT mode (Rs 10,000)...');
    const instRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'INSTANT',
        slip_number: 'SLIP-INST-001'
      })
    });
    const instData = await instRes.json();
    assert.equal(instRes.status, 200, `Expected 200, got ${instRes.status}: ${JSON.stringify(instData)}`);
    assert.equal(instData.transaction.customer_charge_paise, '18000', 'Merchant charge at 1.80% must be 18,000 paise (Rs 180)');
    assert.equal(instData.transaction.net_amount_paise, '982000', 'Merchant net must be 982,000 paise (Rs 9,820)');

    // Verify distributions used INSTANT rates:
    // Area: 180 - 160 = 20 bps -> Rs 20 (2,000 paise)
    // Dist: 160 - 130 = 30 bps -> Rs 30 (3,000 paise)
    // SD: 130 - 110 = 20 bps -> Rs 20 (2,000 paise)
    // Master: 110 - 90 = 20 bps -> Rs 20 (2,000 paise)
    // Admin: 90 - 0 = remainder -> Rs 90 (9,000 paise, including 60 bps cut + 30 bps margin)
    // Total: 20 + 30 + 20 + 20 + 90 = 180. Net + Fees = 10,000.
    const dists = instData.transaction.distributions;
    const areaDist = dists.find(d => d.user_id === 'AREA3001');
    assert.equal(areaDist.amount_paise, '3000', 'Area margin must be Rs 30 (3,000 paise) using Instant rates (160 - 130 bps)');

    // -----------------------------------------------------------------
    // TEST 2: Swipe in T+1 mode for Pine Labs
    // -----------------------------------------------------------------
    console.log('2. Testing swipe in T+1 mode (Rs 10,000)...');
    const t1Res = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 10000,
        channel: 'pinelabs',
        settlement_type: 'T1',
        slip_number: 'SLIP-T1-001'
      })
    });
    const t1Data = await t1Res.json();
    assert.equal(t1Res.status, 200, `Expected 200, got ${t1Res.status}: ${JSON.stringify(t1Data)}`);
    assert.equal(t1Data.transaction.customer_charge_paise, '15000', 'Merchant charge at 1.50% must be 15,000 paise (Rs 150)');
    assert.equal(t1Data.transaction.net_amount_paise, '985000', 'Merchant net must be 985,000 paise (Rs 9,850)');

    // -----------------------------------------------------------------
    // TEST 3: Pine Labs swipe with NO settlement_type must be REJECTED (HTTP 400)
    // -----------------------------------------------------------------
    console.log('3. Testing Pine Labs swipe with missing settlement_type...');
    const noModeRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 5000,
        channel: 'pinelabs',
        slip_number: 'SLIP-NOMODE-001'
      })
    });
    assert.equal(noModeRes.status, 400, 'Swipe with missing settlement_type must be rejected with HTTP 400');
    const noModeData = await noModeRes.json();
    assert(noModeData.message.includes('SETTLEMENT_MODE_REQUIRED'), 'Error message must cite SETTLEMENT_MODE_REQUIRED');

    // -----------------------------------------------------------------
    // TEST 4: QR swipe with T1 or INSTANT mode must be REJECTED (HTTP 400)
    // -----------------------------------------------------------------
    console.log('4. Testing QR swipe with mode (must be rejected)...');
    const qrWithModeRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 5000,
        channel: 'qr',
        settlement_type: 'T1',
        slip_number: 'SLIP-QR-001'
      })
    });
    assert.equal(qrWithModeRes.status, 400, 'QR with mode must be rejected with HTTP 400');
    const qrWithModeData = await qrWithModeRes.json();
    assert(qrWithModeData.message.includes('INVALID_SETTLEMENT_MODE'), 'Error message must cite INVALID_SETTLEMENT_MODE');

    // -----------------------------------------------------------------
    // TEST 5: QR swipe when uplines have no QR rate must be REJECTED (RATE_NOT_CONFIGURED)
    // -----------------------------------------------------------------
    console.log('5. Testing QR swipe when uplines have no QR rate...');
    const qrUnconfiguredRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 5000,
        channel: 'qr',
        slip_number: 'SLIP-QR-UNCONFIG-001'
      })
    });
    assert.equal(qrUnconfiguredRes.status, 400, 'Swipe must be rejected if an upline has no rate configured');
    const qrUnconfigData = await qrUnconfiguredRes.json();
    assert(qrUnconfigData.message.includes('RATE_NOT_CONFIGURED'), 'Error must be RATE_NOT_CONFIGURED');

    // Now configure QR rates for all uplines
    console.log('6. Configuring QR rates for all uplines and re-testing...');
    const setupClient = await pool.connect();
    try {
      await setUserRate(setupClient, { userId: 'MST1001', channel: 'qr', settlementMode: 'NONE', rateBps: 0 });
      await setUserRate(setupClient, { userId: 'SD1001', channel: 'qr', settlementMode: 'NONE', rateBps: 0 });
      await setUserRate(setupClient, { userId: 'DIST2001', channel: 'qr', settlementMode: 'NONE', rateBps: 0 });
      await setUserRate(setupClient, { userId: 'AREA3001', channel: 'qr', settlementMode: 'NONE', rateBps: 0 });
    } finally {
      setupClient.release();
    }

    const qrValidRes = await fetch(`http://127.0.0.1:${PORT}/api/transactions/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: 'MID4001',
        amount: 5000,
        channel: 'qr',
        slip_number: 'SLIP-QR-VALID-001'
      })
    });
    const qrValidData = await qrValidRes.json();
    assert.equal(qrValidRes.status, 200, `Valid QR swipe must succeed: ${JSON.stringify(qrValidData)}`);
    assert.equal(qrValidData.transaction.customer_charge_paise, '0');
    assert.equal(qrValidData.transaction.net_amount_paise, '500000');

    console.log('✅ ALL SWIPE SETTLEMENT MODE TESTS PASSED!');
  } finally {
    server.close();
    await pool.end();
  }
}

testSwipeMode().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
