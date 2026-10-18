import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
process.env.TEST_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/ronav_test_db';
import { getDbPool } from './pg_db.js';
import { resetTestDatabase } from './test_db_helper.js';
import { handleApiRequest } from './api.js';
import { hashPassword, generateToken } from './security.js';

const PORT = 5996;

async function runTest() {
  console.log('=== TEST: Onboard MASTER with Pine Labs, Payswiff & QR Channels ===');

  // 1. Static AST / Code invariant check: Ensure getAuthSession is properly imported and error is not swallowed
  const adminPageCode = fs.readFileSync('src/components/AdminDashboardPage.jsx', 'utf8');
  assert.ok(
    adminPageCode.includes('getAuthSession') && adminPageCode.includes("from '../services/api'"),
    'AdminDashboardPage.jsx must import getAuthSession from ../services/api'
  );
  assert.ok(
    !adminPageCode.includes("triggerToast('Error creating user', 'error')"),
    'AdminDashboardPage.jsx must surface real error message, never hardcoded "Error creating user"'
  );
  console.log('  ✓ Static Invariant: getAuthSession imported and error toast surfaces real reason.');

  // 2. Initialize clean test DB schema with ADM001
  await resetTestDatabase();
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    const hashed = hashPassword('Ronav@123');
    await client.query(`
      INSERT INTO users (id, name, mobile, role, creator_id, password, status)
      VALUES ('ADM001', 'RONAV Super Admin', '9966203053', 'ADMIN', null, $1, 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `, [hashed]);
    await client.query(`
      INSERT INTO wallets (user_id, balance_paise, held_paise, total_sales_paise, withdrawn_paise)
      VALUES ('ADM001', 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;
    `);
  } finally {
    client.release();
  }

  // 3. Start test HTTP server
  const server = http.createServer((req, res) => {
    handleApiRequest(req, res).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`  ✓ Test HTTP server running on port ${PORT}`);

  try {
    const adminToken = generateToken({ id: 'ADM001', role: 'ADMIN', name: 'RONAV Super Admin' });

    // 4. Test API Onboarding for MASTER with Pine Labs, Payswiff, and QR
    const payload = {
      creator_id: 'ADM001',
      parent_id: 'ADM001',
      name: 'Nikhil Master Test',
      mobile: '9966203001',
      email: 'nikhil.master@ronav.in',
      aadhaar: '123456789012',
      pan: 'ABCDE1234F',
      address: 'Hyderabad, Telangana',
      role: 'MASTER',
      margin_rate: '0.00',
      channels: {
        pine_labs: {
          enabled: true,
          terminal_id: 'PL-9921',
          vendor: 'Rose Navaneetham Enterprises',
          plan: 'RENTAL',
          rent: '499',
          rate_t1: '1.20',
          rate_instant: '1.30'
        },
        payswiff: {
          enabled: true,
          terminal_id: 'nwi20290',
          vendor: 'RONAV Technologies',
          plan: 'RENTAL',
          rent: '499',
          rate_t1: '1.40',
          rate_instant: '1.50'
        },
        qr: {
          enabled: true,
          vendor: 'RONAV Technologies',
          rate_instant: '1.60'
        }
      },
      pos_provider: 'Pine Labs',
      pos_vendor: 'Rose Navaneetham Enterprises',
      pos_terminal_id: 'PL-9921',
      device_plan: 'RENTAL',
      monthly_rent: '499',
      settlement_type: 'T1',
      commission_rate_t1: '1.20',
      commission_rate_instant: '1.30'
    };

    const res = await fetch(`http://127.0.0.1:${PORT}/api/users/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = await res.json();
    assert.equal(data.success, true, 'User creation should succeed');
    assert.ok(data.user.id.startsWith('MST'), `Expected ID to start with MST, got ${data.user.id}`);
    assert.equal(data.user.role, 'SUPER_DISTRIBUTOR', 'Master role maps to SUPER_DISTRIBUTOR');
    console.log(`  ✓ Onboarded user successfully with ID: ${data.user.id}`);

    // Verify database rates
    const qClient = await pool.connect();
    try {
      const ratesRes = await qClient.query(`
        SELECT channel, settlement_mode, rate_bps 
        FROM user_channel_rates 
        WHERE user_id = $1 
        ORDER BY channel, settlement_mode
      `, [data.user.id]);

      const rateMap = {};
      ratesRes.rows.forEach(r => {
        rateMap[`${r.channel}_${r.settlement_mode}`] = r.rate_bps;
      });

      assert.equal(rateMap['pinelabs_T1'], 120, 'Pine Labs T1 rate should be 120 bps');
      assert.equal(rateMap['pinelabs_INSTANT'], 130, 'Pine Labs Instant rate should be 130 bps');
      assert.equal(rateMap['payswiff_T1'], 140, 'Payswiff T1 rate should be 140 bps');
      assert.equal(rateMap['payswiff_INSTANT'], 150, 'Payswiff Instant rate should be 150 bps');
      assert.equal(rateMap['qr_NONE'], 160, 'QR rate should be 160 bps');
      console.log('  ✓ Verified all 5 channel rates in user_channel_rates table.');

      // Verify POS portfolio
      const posRes = await qClient.query(`SELECT * FROM merchant_pos WHERE merchant_id = $1`, [data.user.id]);
      assert.equal(posRes.rows.length, 1, 'Should have 1 merchant_pos record');
      assert.ok(posRes.rows[0].terminal_id.startsWith('[PORTFOLIO]'), 'Terminal ID should record [PORTFOLIO]');
      console.log('  ✓ Verified merchant_pos portfolio record.');

      // Test duplicate mobile rejection returns plain descriptive error
      const dupRes = await fetch(`http://127.0.0.1:${PORT}/api/users/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify(payload)
      });
      assert.equal(dupRes.status, 400, 'Duplicate mobile should return 400');
      const dupData = await dupRes.json();
      assert.equal(dupData.success, false);
      assert.ok(
        dupData.message.includes('unique') || dupData.message.includes('duplicate') || dupData.message.includes('already exists'),
        'Server returns clear duplicate error message'
      );
      console.log(`  ✓ Duplicate attempt returned descriptive error: "${dupData.message}"`);
    } finally {
      qClient.release();
    }

    console.log('=== ALL ASSERTIONS PASSED ===\n');
  } finally {
    server.close();
    await pool.end();
  }
}

runTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
