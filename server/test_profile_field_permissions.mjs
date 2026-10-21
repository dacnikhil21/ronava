import assert from 'node:assert/strict';
import http from 'node:http';
import { pgQuery } from './pg_db.js';
import { generateToken } from './security.js';
import { handleApiRequest } from './api.js';

async function runTests() {
  console.log('========================================================================');
  console.log('=== TEST: PROFILE FIELD-LEVEL AUTHORIZATION GUARDS (STEP 3) ===');
  console.log('========================================================================\n');

  // Setup Test Users in Database:
  // 1. Admin: ADM001
  // 2. Distributor: TEST_DIST_301 (creator_id = ADM001)
  // 3. Downline Merchant: TEST_MID_301 (creator_id = TEST_DIST_301)
  const distId = 'TEST_DIST_301';
  const midId = 'TEST_MID_301';

  await pgQuery(`
    INSERT INTO users (id, name, mobile, role, creator_id, commission_rate_t1, commission_rate_instant, margin_rate, status)
    VALUES 
      ($1, 'Test Distributor 301', '9888877771', 'DISTRIBUTOR', 'ADM001', 1.0, 1.2, 0.5, 'ACTIVE'),
      ($2, 'Test Merchant 301', '9888877772', 'MERCHANT', $1, 1.5, 1.8, 1.0, 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET 
      creator_id = EXCLUDED.creator_id,
      commission_rate_t1 = EXCLUDED.commission_rate_t1,
      commission_rate_instant = EXCLUDED.commission_rate_instant,
      margin_rate = EXCLUDED.margin_rate,
      name = EXCLUDED.name,
      mobile = EXCLUDED.mobile
  `, [distId, midId]);

  // Generate Tokens
  const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'Super Admin' });
  const distToken = generateToken({ id: distId, role: 'DISTRIBUTOR', name: 'Test Distributor 301' });
  const midToken = generateToken({ id: midId, role: 'MERCHANT', name: 'Test Merchant 301' });

  // Start self-contained ephemeral test server
  const testServer = http.createServer(async (req, res) => {
    if (req.url && req.url.startsWith('/api/')) {
      await handleApiRequest(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => testServer.listen(0, '127.0.0.1', resolve));
  const testPort = testServer.address().port;
  console.log(`Test server running on port ${testPort}`);

  function makePost(path, body, token) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request({
        hostname: '127.0.0.1',
        port: testPort,
        path,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Merchant updates permitted contact info (name, mobile, email, address)
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Verifying Merchant can update legitimate contact info...');
    const updateContactRes = await makePost('/api/users/update-profile', {
      userId: midId,
      name: 'Updated Merchant Name',
      mobile: '9888877773',
      email: 'updated_merchant@gmail.com',
      address: '123 Test Street'
    }, midToken);

    assert.equal(updateContactRes.statusCode, 200, 'Expected status 200 for permitted fields');
    assert.equal(updateContactRes.body.success, true);
    assert.equal(updateContactRes.body.user.name, 'Updated Merchant Name');
    assert.equal(updateContactRes.body.user.mobile, '9888877773');

    // Verify in database
    const dbMid1 = (await pgQuery(`SELECT name, mobile, email, address FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(dbMid1.name, 'Updated Merchant Name');
    assert.equal(dbMid1.mobile, '9888877773');
    assert.equal(dbMid1.email, 'updated_merchant@gmail.com');
    assert.equal(dbMid1.address, '123 Test Street');
    console.log('  ✓ TEST 1 PASSED: Merchant successfully updated personal contact fields.\n');

    // -------------------------------------------------------------------------
    // TEST 2: Merchant attempts to change own creator_id -> MUST FAIL (403)
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Verifying Merchant CANNOT change own creator_id...');
    const rogueCreatorRes = await makePost('/api/users/update-profile', {
      userId: midId,
      creator_id: 'ADM001'
    }, midToken);

    assert.equal(rogueCreatorRes.statusCode, 403, 'Expected status 403 for creator_id alteration');
    assert.equal(rogueCreatorRes.body.success, false);
    assert.ok(rogueCreatorRes.body.message.includes('ACCESS_FORBIDDEN'));

    // Verify database creator_id was NOT changed
    const dbMid2 = (await pgQuery(`SELECT creator_id FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(dbMid2.creator_id, distId, 'creator_id must remain unchanged in database');
    console.log('  ✓ TEST 2 PASSED: Merchant denied altering creator_id (HTTP 403).\n');

    // -------------------------------------------------------------------------
    // TEST 3: Merchant attempts to change own commission_rate_t1 -> MUST FAIL (403)
    // -------------------------------------------------------------------------
    console.log('[TEST 3] Verifying Merchant CANNOT change own commission_rate_t1...');
    const rogueRateT1Res = await makePost('/api/users/update-profile', {
      userId: midId,
      commission_rate_t1: 0.01
    }, midToken);

    assert.equal(rogueRateT1Res.statusCode, 403, 'Expected status 403 for commission_rate_t1');
    assert.equal(rogueRateT1Res.body.success, false);
    assert.ok(rogueRateT1Res.body.message.includes('ACCESS_FORBIDDEN'));

    const dbMid3 = (await pgQuery(`SELECT commission_rate_t1 FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(Number(dbMid3.commission_rate_t1), 1.5, 'commission_rate_t1 must remain unchanged');
    console.log('  ✓ TEST 3 PASSED: Merchant denied altering commission_rate_t1 (HTTP 403).\n');

    // -------------------------------------------------------------------------
    // TEST 4: Merchant attempts to change own commission_rate_instant -> MUST FAIL (403)
    // -------------------------------------------------------------------------
    console.log('[TEST 4] Verifying Merchant CANNOT change own commission_rate_instant...');
    const rogueRateInstRes = await makePost('/api/users/update-profile', {
      userId: midId,
      commission_rate_instant: 0.02
    }, midToken);

    assert.equal(rogueRateInstRes.statusCode, 403, 'Expected status 403 for commission_rate_instant');
    assert.equal(rogueRateInstRes.body.success, false);
    assert.ok(rogueRateInstRes.body.message.includes('ACCESS_FORBIDDEN'));

    const dbMid4 = (await pgQuery(`SELECT commission_rate_instant FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(Number(dbMid4.commission_rate_instant), 1.8, 'commission_rate_instant must remain unchanged');
    console.log('  ✓ TEST 4 PASSED: Merchant denied altering commission_rate_instant (HTTP 403).\n');

    // -------------------------------------------------------------------------
    // TEST 5: Merchant attempts to change own margin_rate -> MUST FAIL (403)
    // -------------------------------------------------------------------------
    console.log('[TEST 5] Verifying Merchant CANNOT change own margin_rate...');
    const rogueMarginRes = await makePost('/api/users/update-profile', {
      userId: midId,
      margin_rate: 0.00
    }, midToken);

    assert.equal(rogueMarginRes.statusCode, 403, 'Expected status 403 for margin_rate');
    assert.equal(rogueMarginRes.body.success, false);
    assert.ok(rogueMarginRes.body.message.includes('ACCESS_FORBIDDEN'));

    const dbMid5 = (await pgQuery(`SELECT margin_rate FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(Number(dbMid5.margin_rate), 1.0, 'margin_rate must remain unchanged');
    console.log('  ✓ TEST 5 PASSED: Merchant denied altering margin_rate (HTTP 403).\n');

    // -------------------------------------------------------------------------
    // TEST 6: Distributor attempts to change downline Merchant's rates / creator_id -> MUST FAIL (403)
    // -------------------------------------------------------------------------
    console.log('[TEST 6] Verifying Distributor CANNOT change downline Merchant sensitive fields...');
    const distRogueRes = await makePost('/api/users/update-profile', {
      userId: midId,
      creator_id: 'ADM001',
      margin_rate: 0.2
    }, distToken);

    assert.equal(distRogueRes.statusCode, 403, 'Expected status 403 for downline sensitive change by distributor');
    assert.equal(distRogueRes.body.success, false);
    assert.ok(distRogueRes.body.message.includes('ACCESS_FORBIDDEN'));

    const dbMid6 = (await pgQuery(`SELECT creator_id, margin_rate FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(dbMid6.creator_id, distId, 'creator_id must remain unchanged');
    assert.equal(Number(dbMid6.margin_rate), 1.0, 'margin_rate must remain unchanged');
    console.log('  ✓ TEST 6 PASSED: Distributor denied altering downline sensitive fields (HTTP 403).\n');

    // -------------------------------------------------------------------------
    // TEST 7: Admin legitimately updates creator_id and rates -> MUST SUCCEED (200)
    // -------------------------------------------------------------------------
    console.log('[TEST 7] Verifying Admin CAN legitimately update creator_id and rate fields...');
    const adminUpdateRes = await makePost('/api/users/update-profile', {
      userId: midId,
      name: 'Merchant Admin Updated',
      creator_id: 'ADM001',
      commission_rate_t1: 1.6,
      commission_rate_instant: 2.0,
      margin_rate: 1.1
    }, adminToken);

    assert.equal(adminUpdateRes.statusCode, 200, 'Expected status 200 for Admin updates');
    assert.equal(adminUpdateRes.body.success, true);
    assert.equal(adminUpdateRes.body.user.creator_id, 'ADM001');
    assert.equal(Number(adminUpdateRes.body.user.commission_rate_t1), 1.6);
    assert.equal(Number(adminUpdateRes.body.user.commission_rate_instant), 2.0);
    assert.equal(Number(adminUpdateRes.body.user.margin_rate), 1.1);

    // Verify in database
    const dbMid7 = (await pgQuery(`SELECT name, creator_id, commission_rate_t1, commission_rate_instant, margin_rate FROM users WHERE id = $1`, [midId]))[0];
    assert.equal(dbMid7.name, 'Merchant Admin Updated');
    assert.equal(dbMid7.creator_id, 'ADM001');
    assert.equal(Number(dbMid7.commission_rate_t1), 1.6);
    assert.equal(Number(dbMid7.commission_rate_instant), 2.0);
    assert.equal(Number(dbMid7.margin_rate), 1.1);
    console.log('  ✓ TEST 7 PASSED: Admin successfully updated profile, hierarchy, and rates.\n');

    console.log('========================================================================');
    console.log('=== ALL STEP 3 FIELD-LEVEL AUTHORIZATION TESTS PASSED! ===');
    console.log('========================================================================\n');
  } finally {
    testServer.close();
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
