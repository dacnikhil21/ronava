import assert from 'node:assert/strict';
import http from 'node:http';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { setUserRate } from './rate_engine.js';
import { handleApiRequest } from './api.js';

const PORT = 5997;

async function testHierarchyRules() {
  console.log('=== TEST SUITE: Phase D1b Hierarchy Rule & User Creation / Updates ===');
  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // Setup Admin and Parent Distributor
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id) VALUES
        ('ADM001', 'Admin', '9999000001', 'ADMIN', NULL),
        ('DIST100', 'Parent Dist', '9999000002', 'DISTRIBUTOR', 'ADM001')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Admin has Pine Labs T1: 60 bps, Instant: 60 bps
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'T1', rateBps: 60 });
    await setUserRate(client, { userId: 'ADM001', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 60 });

    // Parent Dist has Pine Labs T1: 120 bps (1.2%), Instant: 150 bps (1.5%)
    // Parent Dist does NOT have Payswiff or QR!
    await setUserRate(client, { userId: 'DIST100', channel: 'pinelabs', settlementMode: 'T1', rateBps: 120 });
    await setUserRate(client, { userId: 'DIST100', channel: 'pinelabs', settlementMode: 'INSTANT', rateBps: 150 });
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
    // -----------------------------------------------------------------
    // TEST 1: Reject child creation if child Instant rate < parent Instant rate,
    // even though child T1 rate >= parent T1 rate!
    // Parent: T1 = 1.20% (120 bps), Instant = 1.50% (150 bps)
    // Child:  T1 = 1.30% (130 bps >= 120 bps OK), Instant = 1.40% (140 bps < 150 bps FAIL!)
    // -----------------------------------------------------------------
    console.log('1. Testing child creation with Instant rate lower than parent Instant rate...');
    const failRes1 = await fetch(`http://127.0.0.1:${PORT}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Child Merchant Bad Instant',
        mobile: '9888800001',
        role: 'MERCHANT',
        creator_id: 'DIST100',
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '1.30',
            rate_instant: '1.40' // < parent's 1.50%!
          }
        }
      })
    });
    assert.equal(failRes1.status, 400, 'Creation must be rejected when Instant rate < parent Instant rate');
    const failData1 = await failRes1.json();
    assert(failData1.message.includes('INVALID_RATE_HIERARCHY'), `Message must cite INVALID_RATE_HIERARCHY: ${failData1.message}`);

    // -----------------------------------------------------------------
    // TEST 2: Reject child creation if child is given a channel parent does NOT have!
    // Parent DIST100 does NOT have Payswiff.
    // -----------------------------------------------------------------
    console.log('2. Testing child creation with channel parent does not have...');
    const failRes2 = await fetch(`http://127.0.0.1:${PORT}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Child Merchant Bad Channel',
        mobile: '9888800002',
        role: 'MERCHANT',
        creator_id: 'DIST100',
        channels: {
          payswiff: {
            enabled: true,
            rate_t1: '1.80',
            rate_instant: '2.00'
          }
        }
      })
    });
    assert.equal(failRes2.status, 400, 'Creation must be rejected when parent does not have channel');
    const failData2 = await failRes2.json();
    assert(failData2.message.includes('PARENT_CHANNEL_MISSING'), `Message must cite PARENT_CHANNEL_MISSING: ${failData2.message}`);

    // -----------------------------------------------------------------
    // TEST 3: Successful child creation with valid rates for both modes
    // Child: T1 = 1.30% (130 bps >= 120 bps), Instant = 1.60% (160 bps >= 150 bps)
    // -----------------------------------------------------------------
    console.log('3. Testing valid child creation with valid rates on both modes...');
    const successRes = await fetch(`http://127.0.0.1:${PORT}/api/users/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Child Merchant Good',
        mobile: '9888800003',
        role: 'MERCHANT',
        creator_id: 'DIST100',
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '1.30',
            rate_instant: '1.60'
          }
        }
      })
    });
    const successData = await successRes.json();
    assert.equal(successRes.status, 200, `Child creation must succeed: ${JSON.stringify(successData)}`);
    const newMerchantId = successData.user.id;

    // -----------------------------------------------------------------
    // TEST 4: Reject channel update (/api/channels/update) if rate < parent rate
    // -----------------------------------------------------------------
    console.log('4. Testing channels update with rate < parent rate...');
    const updateFailRes = await fetch(`http://127.0.0.1:${PORT}/api/channels/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: newMerchantId,
        channels: {
          pine_labs: {
            enabled: true,
            rate_t1: '1.10', // < parent's 1.20%!
            rate_instant: '1.60'
          }
        }
      })
    });
    assert.equal(updateFailRes.status, 400, 'Update must be rejected when T1 rate < parent rate');
    const updateFailData = await updateFailRes.json();
    assert(updateFailData.message.includes('INVALID_RATE_HIERARCHY'), `Must cite INVALID_RATE_HIERARCHY: ${updateFailData.message}`);

    console.log('✅ ALL HIERARCHY RULE TESTS PASSED!');
  } finally {
    server.close();
    await pool.end();
  }
}

testHierarchyRules().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
