import assert from 'assert';
import { getApiUrl } from '../src/services/supabase.js';

const BASE_URL = 'http://localhost:3000';

async function testSafeEndpoints() {
  console.log('=== TEST FIX A: Safe Non-Admin Endpoints ===');

  // 1. Log in as Merchant (MID1001)
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'MID1001', password: 'Ronav@123' })
  });
  const loginJson = await loginRes.json();
  assert.equal(loginRes.status, 200, 'Merchant login must succeed');
  const token = loginJson.token;
  assert.ok(token, 'Must receive auth token');

  const merchantHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 2. Fetch SYS-CONFIG-QR as merchant (must be 200, not 403)
  console.log('Testing GET /api/settings/config/SYS-CONFIG-QR as merchant...');
  const qrRes = await fetch(`${BASE_URL}/api/settings/config/SYS-CONFIG-QR`, { headers: merchantHeaders });
  assert.equal(qrRes.status, 200, 'GET /api/settings/config/SYS-CONFIG-QR must return 200 for authenticated merchant');
  const qrJson = await qrRes.json();
  assert.equal(qrJson.success, true, 'QR config response must be success: true');

  // 3. Fetch SYS-COMMISSION-PAYOUTS as merchant (must be 200, not 403)
  console.log('Testing GET /api/settings/config/SYS-COMMISSION-PAYOUTS as merchant...');
  const commRes = await fetch(`${BASE_URL}/api/settings/config/SYS-COMMISSION-PAYOUTS`, { headers: merchantHeaders });
  assert.equal(commRes.status, 200, 'GET /api/settings/config/SYS-COMMISSION-PAYOUTS must return 200 for authenticated merchant');
  const commJson = await commRes.json();
  assert.equal(commJson.success, true, 'Commission config response must be success: true');

  // 4. Verify writing config as merchant is STILL strictly forbidden (403)
  console.log('Verifying POST /api/settings/config remains strictly admin-only...');
  const postConfigRes = await fetch(`${BASE_URL}/api/settings/config`, {
    method: 'POST',
    headers: merchantHeaders,
    body: JSON.stringify({ key: 'SYS-CONFIG-QR', value: { image: 'test' } })
  });
  assert.equal(postConfigRes.status, 403, 'POST /api/settings/config must reject non-admins with 403 Forbidden');

  // 5. Test scoped rentals report for non-admin
  console.log('Testing scoped rentals report endpoint for merchant...');
  const rentalRes = await fetch(`${BASE_URL}/api/pos-rentals-report?monthKey=2026-10`, { headers: merchantHeaders });
  assert.equal(rentalRes.status, 200, 'GET /api/pos-rentals-report must return 200 for authenticated merchant');
  const rentalJson = await rentalRes.json();
  assert.equal(rentalJson.success, true, 'Scoped rentals report must succeed');

  // 6. Verify /api/admin/pos-rentals-report remains strictly admin-only (403)
  console.log('Verifying /api/admin/pos-rentals-report remains strictly admin-only...');
  const adminRentalRes = await fetch(`${BASE_URL}/api/admin/pos-rentals-report?monthKey=2026-10`, { headers: merchantHeaders });
  assert.equal(adminRentalRes.status, 403, 'GET /api/admin/pos-rentals-report must reject non-admins with 403 Forbidden');

  console.log('✅ TEST FIX A PASSED: Non-admin safe endpoints work without weakening security.');
}

testSafeEndpoints().catch(err => {
  console.error('❌ TEST FIX A FAILED:', err.message);
  process.exit(1);
});
