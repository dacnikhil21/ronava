// server/test_step1_real_roles.mjs
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ronav_test_db';

import assert from 'node:assert/strict';
import { getDbPool, pgQuery } from './pg_db.js';
import { handleApiRequest } from './api.js';
import http from 'node:http';
import { generateToken } from './security.js';

const PORT = 5991;
const BASE_URL = `http://localhost:${PORT}`;

async function runTest() {
  console.log('--- RUNNING STEP 1 ROLES TEST ---');
  const pool = getDbPool();

  // Start temporary test server
  const server = http.createServer(async (req, res) => {
    try {
      await handleApiRequest(req, res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise(r => server.listen(PORT, r));

  try {
    const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN' });
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // 1. Check existing hand-made users' roles in database
    console.log('1. Checking hand-made users roles in DB...');
    const users = await pgQuery('SELECT id, name, role FROM users WHERE id IN (\'MST1002\', \'DD1001\', \'DIST1001\', \'SD1001\')');
    const userRoleMap = Object.fromEntries(users.map(u => [u.id, u.role]));

    assert.equal(userRoleMap['MST1002'], 'MASTER', `MST1002 must have role MASTER, found: ${userRoleMap['MST1002']}`);
    assert.equal(userRoleMap['DD1001'], 'DISTRICT_DISTRIBUTOR', `DD1001 must have role DISTRICT_DISTRIBUTOR, found: ${userRoleMap['DD1001']}`);
    assert.equal(userRoleMap['DIST1001'], 'DISTRIBUTOR', `DIST1001 must have role DISTRIBUTOR, found: ${userRoleMap['DIST1001']}`);
    assert.equal(userRoleMap['SD1001'], 'SUPER_DISTRIBUTOR', `SD1001 must have role SUPER_DISTRIBUTOR, found: ${userRoleMap['SD1001']}`);
    console.log('   ✓ Hand-made users have correct chain roles in DB.');

    // 2. Check /api/admin/pending tier totals for the 10,000 swipe
    console.log('2. Checking /api/admin/pending tier summary...');
    const res = await fetch(`${BASE_URL}/api/admin/pending`, { headers: authHeaders });
    const data = await res.json();
    assert.ok(data.success, 'Failed to fetch /api/admin/pending');

    const tierTotals = data.stats?.tierTotals;
    assert.ok(tierTotals, 'Missing tierTotals in stats');
    console.log('   Tier totals returned:', tierTotals);

    assert.equal(tierTotals.master, 10, `Master must be 10, got ${tierTotals.master}`);
    assert.equal(tierTotals.super, 10, `Super Dist must be 10, got ${tierTotals.super}`);
    assert.equal(tierTotals.district, 10, `District must be 10, got ${tierTotals.district}`);
    assert.equal(tierTotals.distributor, 10, `Area Distributor must be 10, got ${tierTotals.distributor}`);
    assert.equal(tierTotals.companyNet, 120, `Admin share must be 120, got ${tierTotals.companyNet}`);
    console.log('   ✓ Tier totals match exactly: Master 10, Super Dist 10, District 10, Area 10, Admin 120.');

    console.log('✅ STEP 1 TEST PASSED!');
  } finally {
    server.close();
  }
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error('❌ STEP 1 TEST FAILED:', err.message);
  process.exit(1);
});
